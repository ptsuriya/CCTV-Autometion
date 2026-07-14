#!/usr/bin/env python3
"""Local CCTV capture UI with live scheduling and historical playback capture."""

import json
import logging
import math
import os
import re
import shutil
import signal
import socket
import subprocess
import threading
import time
import uuid
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone as dt_timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, parse_qsl, quote, unquote, urlparse, urlsplit, urlunsplit, urlencode
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
CAPTURES_DIR = ROOT / "captures"
EXPORTS_DIR = ROOT / "exports"
STATE_FILE = DATA_DIR / "state.json"
STATIC_INDEX = ROOT / "static" / "index.html"
STOP_EVENT = threading.Event()
JOB_LOCK = threading.Lock()
STATE_LOCK = threading.RLock()
SERVER = None
CANCEL_EVENT = threading.Event()


class JobCancelled(Exception):
    pass


def load_dotenv(path):
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_dotenv(ROOT / ".env")


def env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def parse_channels(value, fallback):
    result = []
    for item in value.split(",") if value else []:
        try:
            channel = int(item.strip())
            if channel > 0 and channel not in result:
                result.append(channel)
        except ValueError:
            continue
    return result or list(fallback)


TIMEZONE_NAME = os.getenv("CCTV_TIMEZONE", "Asia/Bangkok")
try:
    LOCAL_TZ = ZoneInfo(TIMEZONE_NAME)
except Exception:
    # Windows Python installations may not include the IANA tzdata package.
    # Bangkok has no daylight-saving changes, so UTC+7 is a safe fallback.
    LOCAL_TZ = dt_timezone(timedelta(hours=7), "Asia/Bangkok")

def resolve_ffmpeg(configured):
    """Resolve ffmpeg even when Windows did not refresh PATH after winget."""
    configured = (configured or "ffmpeg").strip().strip('"').strip("'")
    direct = Path(configured).expanduser()
    if direct.is_file():
        return str(direct)
    discovered = shutil.which(configured)
    if discovered:
        return discovered
    if os.name != "nt":
        return configured

    candidates = [
        Path(os.getenv("ProgramFiles", r"C:\Program Files")) / "ffmpeg" / "bin" / "ffmpeg.exe",
        Path(os.getenv("ProgramData", r"C:\ProgramData")) / "chocolatey" / "bin" / "ffmpeg.exe",
        Path(os.getenv("LOCALAPPDATA", "")) / "Scoop" / "shims" / "ffmpeg.exe",
        Path(os.getenv("USERPROFILE", "")) / "scoop" / "shims" / "ffmpeg.exe",
        Path(r"C:\ffmpeg\bin\ffmpeg.exe"),
    ]
    winget_packages = Path(os.getenv("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    if winget_packages.is_dir():
        for package_dir in winget_packages.glob("Gyan.FFmpeg*"):
            candidates.extend(package_dir.rglob("ffmpeg.exe"))
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return configured


LIVE_HOST = os.getenv("CCTV_LIVE_HOST", "arit-camera.rbru.ac.th")
LIVE_PORT = env_int("CCTV_LIVE_PORT", 554)
LIVE_USERNAME = os.getenv("CCTV_USERNAME", "")
LIVE_PASSWORD = os.getenv("CCTV_PASSWORD", "")
PLAYBACK_HOST = os.getenv("CCTV_PLAYBACK_HOST", LIVE_HOST)
PLAYBACK_PORT = env_int("CCTV_PLAYBACK_PORT", LIVE_PORT)
PLAYBACK_USERNAME = os.getenv("CCTV_PLAYBACK_USERNAME", LIVE_USERNAME)
PLAYBACK_PASSWORD = os.getenv("CCTV_PLAYBACK_PASSWORD", LIVE_PASSWORD)
ISAPI_HOST = os.getenv("CCTV_ISAPI_HOST", LIVE_HOST)
ISAPI_PORT = env_int("CCTV_ISAPI_PORT", 80)
ISAPI_USERNAME = os.getenv("CCTV_ISAPI_USERNAME", LIVE_USERNAME)
ISAPI_PASSWORD = os.getenv("CCTV_ISAPI_PASSWORD", LIVE_PASSWORD)
FFMPEG = resolve_ffmpeg(os.getenv("CCTV_FFMPEG", "ffmpeg"))
MAX_WORKERS = max(1, env_int("CCTV_MAX_WORKERS", 6))
CAPTURE_DURATION = max(1, env_int("CCTV_CAPTURE_DURATION_SECONDS", 60))
FRAME_TIMEOUT_SECONDS = max(5, env_int("CCTV_FRAME_TIMEOUT_SECONDS", 20))
PLAYBACK_SEARCH_TIME_MODE = os.getenv("CCTV_PLAYBACK_SEARCH_TIME", "local").strip().lower()
if PLAYBACK_SEARCH_TIME_MODE not in {"local", "utc"}:
    PLAYBACK_SEARCH_TIME_MODE = "local"
PLAYBACK_SEARCH_PADDING_SECONDS = max(0, env_int("CCTV_PLAYBACK_SEARCH_PADDING_SECONDS", 120))
OVERVIEW_COLUMNS = max(1, env_int("CCTV_OVERVIEW_COLUMNS", 6))
CHANNELS = parse_channels(
    os.getenv("CCTV_CHANNELS", ""),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 20],
)
DEFAULT_SEPARATE = parse_channels(os.getenv("CCTV_SEPARATE_CHANNELS", ""), CHANNELS[:4])
SCHEDULE_TIMES = [
    item.strip()
    for item in os.getenv("CCTV_SCHEDULE_TIMES", "23:00,04:00").split(",")
    if item.strip()
]


def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


ensure_dirs()

LOGGER = logging.getLogger("cctv_app")
LOGGER.setLevel(logging.INFO)
if not LOGGER.handlers:
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    LOGGER.addHandler(console)
    file_handler = logging.FileHandler(DATA_DIR / "app.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    LOGGER.addHandler(file_handler)


def load_state():
    default = {"enabled": False, "times": list(SCHEDULE_TIMES), "separate_channels": DEFAULT_SEPARATE}
    if not STATE_FILE.exists():
        return default
    try:
        value = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return {
            "enabled": bool(value.get("enabled", False)),
            "times": valid_schedule_times(value.get("times", SCHEDULE_TIMES)),
            "separate_channels": valid_separate_channels(value.get("separate_channels", DEFAULT_SEPARATE)),
        }
    except (OSError, ValueError, AttributeError):
        return default


def save_state(state):
    with STATE_LOCK:
        STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


JOB = {
    "running": False,
    "id": None,
    "mode": None,
    "progress": 0,
    "message": "พร้อมทำงาน",
    "error": None,
    "last_output": None,
}


def valid_separate_channels(channels):
    try:
        values = [int(channel) for channel in channels]
    except (TypeError, ValueError):
        return list(DEFAULT_SEPARATE)
    return [channel for channel in values if channel in CHANNELS]


def valid_schedule_times(times):
    values = []
    for value in times if isinstance(times, list) else []:
        text = str(value).strip()
        try:
            hour, minute = [int(part) for part in text.split(":", 1)]
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                normalized = "%02d:%02d" % (hour, minute)
                if normalized not in values:
                    values.append(normalized)
        except (ValueError, TypeError):
            continue
    return values or list(SCHEDULE_TIMES)


STATE = load_state()


def set_job(**updates):
    with JOB_LOCK:
        JOB.update(updates)


def redact(text):
    return re.sub(r"(rtsp://)([^@\s]+)@", r"\1***@", text or "")


def track_id(channel):
    return "%d01" % channel


def live_url(channel):
    username = quote(LIVE_USERNAME, safe="")
    password = quote(LIVE_PASSWORD, safe="")
    credentials = "%s:%s@" % (username, password) if username else ""
    return "rtsp://%s%s:%d/Streaming/Channels/%s" % (
        credentials,
        LIVE_HOST,
        LIVE_PORT,
        track_id(channel),
    )


def utc_stamp(local_dt):
    return local_dt.astimezone(dt_timezone.utc).strftime("%Y%m%dt%H%M%Sz").lower()


def playback_stamp(local_dt):
    """Hikvision playback query on this NVR expects its configured local time."""
    return local_dt.strftime("%Y%m%dT%H%M%SZ")


def playback_search_stamp(local_dt):
    """Format ContentMgmt search time without confusing Thai local time with UTC."""
    if PLAYBACK_SEARCH_TIME_MODE == "utc":
        return local_dt.astimezone(dt_timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return local_dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def playback_url(channel, local_dt, duration_seconds):
    start = utc_stamp(local_dt)
    end = utc_stamp(local_dt + timedelta(seconds=duration_seconds))
    template = os.getenv(
        "CCTV_PLAYBACK_PATH_TEMPLATE",
        "/Streaming/tracks/{track}?starttime={start}&endtime={end}",
    )
    path = template.format(channel=track_id(channel), track=track_id(channel), start=start, end=end)
    username = quote(PLAYBACK_USERNAME, safe="")
    password = quote(PLAYBACK_PASSWORD, safe="")
    credentials = "%s:%s@" % (username, password) if username else ""
    return "rtsp://%s%s:%d%s" % (credentials, PLAYBACK_HOST, PLAYBACK_PORT, path)


def isapi_base_url():
    port = "" if ISAPI_PORT == 80 else ":%d" % ISAPI_PORT
    return "http://%s%s" % (ISAPI_HOST, port)


def isapi_request(path, method="GET", body=None, timeout=10):
    password_manager = urllib.request.HTTPPasswordMgrWithDefaultRealm()
    password_manager.add_password(None, isapi_base_url(), ISAPI_USERNAME, ISAPI_PASSWORD)
    opener = urllib.request.build_opener(
        urllib.request.HTTPDigestAuthHandler(password_manager),
        urllib.request.HTTPBasicAuthHandler(password_manager),
    )
    data = body.encode("utf-8") if isinstance(body, str) else body
    request = urllib.request.Request(
        isapi_base_url() + path,
        data=data,
        headers={"Content-Type": "application/xml; charset=UTF-8", "Accept": "application/xml"},
        method=method,
    )
    with opener.open(request, timeout=timeout) as response:
        return response.read()


def xml_local_name(tag):
    return tag.rsplit("}", 1)[-1]


def xml_texts(root, name):
    return [element.text.strip() for element in root.iter() if xml_local_name(element.tag) == name and element.text]


def search_recording(channel, local_dt, duration_seconds):
    # The NVR in this project is configured for Asia/Bangkok. Search a small
    # window around the requested minute because recordings are often split
    # into segments and may start a few seconds before the requested time.
    search_start = local_dt - timedelta(seconds=PLAYBACK_SEARCH_PADDING_SECONDS)
    search_end = local_dt + timedelta(seconds=duration_seconds + PLAYBACK_SEARCH_PADDING_SECONDS)
    search_start_text = playback_search_stamp(search_start)
    search_end_text = playback_search_stamp(search_end)
    search_id = str(uuid.uuid4()).upper()
    xml_templates = [
        "<trackIDList><trackID>{track}</trackID></trackIDList>",
        "<trackList><trackID>{track}</trackID></trackList>",
    ]
    last_error = None
    for track_xml in xml_templates:
        body = """<?xml version="1.0" encoding="UTF-8"?>
<CMSearchDescription version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <searchID>{search_id}</searchID>
  {track_xml}
  <timeSpanList><timeSpan><startTime>{start}</startTime><endTime>{end}</endTime></timeSpan></timeSpanList>
  <contentTypeList><contentType>video</contentType></contentTypeList>
  <maxResults>20</maxResults><searchResultPosition>0</searchResultPosition>
        </CMSearchDescription>""".format(search_id=search_id, track_xml=track_xml.format(track=track_id(channel)), start=search_start_text, end=search_end_text)
        try:
            response = isapi_request("/ISAPI/ContentMgmt/search", method="POST", body=body, timeout=10)
            root = ET.fromstring(response)
            playback_values = xml_texts(root, "playbackURI")
            if playback_values:
                return playback_values[0]
            status = xml_texts(root, "responseStatusStrg") or xml_texts(root, "statusString")
            last_error = (
                "ไม่พบไฟล์บันทึกใน NVR (กล้อง %s, %s ถึง %s; สถานะ %s)"
                % (channel, search_start_text, search_end_text, status[0] if status else "NO MATCHES")
            )
        except (urllib.error.HTTPError, urllib.error.URLError, ET.ParseError, OSError) as exc:
            last_error = str(exc)
    return None, last_error


def historical_recording_url(channel, local_dt, duration_seconds):
    result = search_recording(channel, local_dt, duration_seconds)
    if isinstance(result, tuple):
        _, error = result
        raise RuntimeError(error or "ไม่พบไฟล์บันทึก")
    playback_uri = result
    parts = urlsplit(playback_uri)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["starttime"] = playback_stamp(local_dt)
    query["endtime"] = playback_stamp(local_dt + timedelta(seconds=duration_seconds))
    path_query = parts.path
    if query:
        path_query += "?" + urlencode(query)
    username = quote(PLAYBACK_USERNAME, safe="")
    password = quote(PLAYBACK_PASSWORD, safe="")
    credentials = "%s:%s@" % (username, password) if username else ""
    return "rtsp://%s%s:%d%s" % (credentials, PLAYBACK_HOST, PLAYBACK_PORT, path_query)


def capture_frame(channel, output_path, historical, local_dt, duration_seconds):
    if CANCEL_EVENT.is_set():
        raise JobCancelled()
    try:
        url = historical_recording_url(channel, local_dt, duration_seconds) if historical else live_url(channel)
    except RuntimeError as exc:
        return False, str(exc)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_name(output_path.stem + ".part.jpg")
    command = [
        FFMPEG,
        "-hide_banner",
        "-loglevel",
        "error",
        "-rtsp_transport",
        "tcp",
        "-i",
        url,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-y",
        str(temporary_path),
    ]
    process = None
    try:
        process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        started_at = time.monotonic()
        while process.poll() is None:
            if CANCEL_EVENT.is_set():
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                raise JobCancelled()
            if time.monotonic() - started_at > FRAME_TIMEOUT_SECONDS:
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                return False, "หมดเวลารอภาพจากกล้อง"
            time.sleep(0.2)
        stderr = process.communicate()[1]
        result_code = process.returncode
        if result_code == 0 and temporary_path.exists():
            temporary_path.replace(output_path)
            return True, None
        detail = (stderr or "ffmpeg ไม่ได้ส่งภาพกลับมา").strip().splitlines()
        return False, redact(detail[-1] if detail else "ไม่ทราบสาเหตุ")
    except FileNotFoundError:
        return False, "ไม่พบ ffmpeg ตามค่า CCTV_FFMPEG"
    except subprocess.TimeoutExpired:
        return False, "หมดเวลารอภาพจากกล้อง"
    except JobCancelled:
        raise
    except OSError as exc:
        return False, str(exc)
    finally:
        temporary_path.unlink(missing_ok=True)


def make_collage(image_paths, output_path):
    if not image_paths:
        return False
    if len(image_paths) == 1:
        shutil.copy2(image_paths[0], output_path)
        return True

    width, height = 320, 180
    rows = math.ceil(len(image_paths) / OVERVIEW_COLUMNS)
    filters = []
    for index in range(len(image_paths)):
        filters.append(
            "[%d:v]scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1[v%d]"
            % (index, width, height, width, height, index)
        )
    layout = "|".join(
        "%d_%d" % ((index % OVERVIEW_COLUMNS) * width, (index // OVERVIEW_COLUMNS) * height)
        for index in range(len(image_paths))
    )
    inputs = "".join("[v%d]" % index for index in range(len(image_paths)))
    filters.append("%sxstack=inputs=%d:layout=%s:fill=black[out]" % (inputs, len(image_paths), layout))
    command = [FFMPEG, "-hide_banner", "-loglevel", "error"]
    for image_path in image_paths:
        command.extend(["-i", str(image_path)])
    command.extend([
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[out]",
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-y",
        str(output_path),
    ])
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, check=False)
    if result.returncode != 0:
        LOGGER.warning("สร้างภาพรวมไม่สำเร็จ: %s", redact((result.stderr or "").strip().splitlines()[-1] if result.stderr else ""))
        return False
    return output_path.exists()


def capture_batch(local_dt, historical, separate_channels, duration_seconds, job_id, progress_base=0, progress_span=100):
    if CANCEL_EVENT.is_set():
        raise JobCancelled()
    date_name = local_dt.strftime("%Y-%m-%d")
    time_name = local_dt.strftime("%H-%M")
    batch_dir = CAPTURES_DIR / date_name / time_name
    overview_dir = batch_dir / "รวมกล้อง"
    overview_dir.mkdir(parents=True, exist_ok=True)

    frame_paths = {}
    failures = {}
    set_job(
        message="กำลังแคป %d ช่อง..." % len(CHANNELS),
        progress=max(progress_base, 1),
    )

    def capture_one(channel):
        if CANCEL_EVENT.is_set():
            raise JobCancelled()
        filename = "camera-%02d_%s.jpg" % (channel, local_dt.strftime("%Y-%m-%d_%H-%M-%S"))
        output_path = overview_dir / filename
        ok, error = capture_frame(channel, output_path, historical, local_dt, duration_seconds)
        return channel, output_path if ok else None, error

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(capture_one, channel) for channel in CHANNELS]
        for index, future in enumerate(as_completed(futures), start=1):
            if CANCEL_EVENT.is_set():
                raise JobCancelled()
            channel, output_path, error = future.result()
            if output_path:
                frame_paths[channel] = output_path
            else:
                failures[channel] = error or "แคปไม่สำเร็จ"
            progress = progress_base + int(index / len(CHANNELS) * progress_span * 0.8)
            set_job(progress=min(progress, progress_base + progress_span - 1), message="แคปแล้ว %d/%d ช่อง" % (index, len(CHANNELS)))

    successful_paths = [frame_paths[channel] for channel in CHANNELS if channel in frame_paths]
    collage_path = overview_dir / ("ภาพรวม-%d-ช่อง_%s.jpg" % (len(successful_paths), local_dt.strftime("%Y-%m-%d_%H-%M-%S")))
    collage_ok = make_collage(successful_paths, collage_path)

    manifest = {
        "job_id": job_id,
        "mode": "historical" if historical else "live",
        "local_datetime": local_dt.isoformat(),
        "duration_seconds": duration_seconds,
        "overview_channels": CHANNELS,
        "successful_channels": sorted(frame_paths),
        "failed_channels": failures,
        "collage_created": collage_ok,
    }
    manifest_path = batch_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    LOGGER.info("จบรอบ %s: สำเร็จ %d/%d ช่อง", local_dt.strftime("%Y-%m-%d %H:%M"), len(frame_paths), len(CHANNELS))
    set_job(progress=progress_base + progress_span, message="เสร็จรอบ %s" % local_dt.strftime("%H:%M"))
    return manifest_path, failures


def run_job(job_id, local_dt, historical, separate_channels, duration_seconds):
    try:
        manifest_path, failures = capture_batch(local_dt, historical, separate_channels, duration_seconds, job_id)
        no_data = historical and len(failures) == len(CHANNELS)
        message = (
            "ไม่มีข้อมูลกล้องวงจรปิดในวันที่เลือก (%s)" % local_dt.strftime("%Y-%m-%d")
            if no_data
            else "เสร็จแล้ว %d/%d ช่อง" % (len(CHANNELS) - len(failures), len(CHANNELS))
        )
        set_job(running=False, progress=100, message=message, error=None if not failures or no_data else failures, last_output=str(manifest_path))
    except JobCancelled:
        set_job(running=False, progress=0, message="ยกเลิกแล้ว", error=None, last_output=None)
    except Exception as exc:
        LOGGER.exception("งานแคปภาพล้มเหลว")
        set_job(running=False, progress=0, message="งานล้มเหลว", error=str(exc))


def run_night_job(job_id, capture_times, separate_channels, duration_seconds):
    manifests = []
    failures = {}
    try:
        for index, local_dt in enumerate(capture_times):
            progress_base = index * 50
            set_job(
                progress=progress_base,
                message="กำลังประมวลผลรอบ %d/2: %s" % (index + 1, local_dt.strftime("%Y-%m-%d %H:%M")),
            )
            manifest_path, batch_failures = capture_batch(
                local_dt,
                True,
                separate_channels,
                duration_seconds,
                job_id,
                progress_base=progress_base,
                progress_span=50,
            )
            manifests.append(str(manifest_path))
            if batch_failures:
                failures[local_dt.strftime("%Y-%m-%d %H:%M")] = batch_failures
        no_data = len(failures) == len(capture_times) and all(
            len(batch_failures) == len(CHANNELS) for batch_failures in failures.values()
        )
        selected_dates = " และ ".join(local_dt.strftime("%Y-%m-%d") for local_dt in capture_times)
        set_job(
            running=False,
            progress=100,
            message=(
                "ไม่มีข้อมูลกล้องวงจรปิดในวันที่เลือก (%s)" % selected_dates
                if no_data
                else "เสร็จย้อนหลัง 2 ช่วงเวลา"
            ),
            error=None if not failures or no_data else failures,
            last_output=", ".join(manifests),
        )
    except JobCancelled:
        set_job(running=False, progress=0, message="ยกเลิกแล้ว", error=None, last_output=None)
    except Exception as exc:
        LOGGER.exception("งานย้อนหลังข้ามคืนล้มเหลว")
        set_job(running=False, progress=0, message="งานล้มเหลว", error=str(exc))


def start_job(local_dt, historical, separate_channels, duration_seconds):
    if historical:
        reachable, detail = playback_endpoint_status()
        if not reachable:
            return False, detail
    with JOB_LOCK:
        if JOB["running"]:
            return False, "มีงานกำลังทำงานอยู่แล้ว"
        job_id = uuid.uuid4().hex[:12]
        CANCEL_EVENT.clear()
        JOB.update({
            "running": True,
            "id": job_id,
            "mode": "historical" if historical else "live",
            "progress": 0,
            "message": "กำลังเริ่มงาน",
            "error": None,
            "last_output": None,
        })
    thread = threading.Thread(
        target=run_job,
        args=(job_id, local_dt, historical, valid_separate_channels(separate_channels), duration_seconds),
        daemon=True,
    )
    thread.start()
    return True, job_id


def start_night_job(capture_times, separate_channels, duration_seconds):
    reachable, detail = playback_endpoint_status()
    if not reachable:
        return False, detail
    with JOB_LOCK:
        if JOB["running"]:
            return False, "มีงานกำลังทำงานอยู่แล้ว"
        job_id = uuid.uuid4().hex[:12]
        CANCEL_EVENT.clear()
        JOB.update({
            "running": True,
            "id": job_id,
            "mode": "historical-night",
            "progress": 0,
            "message": "กำลังเริ่มงานย้อนหลัง 2 ช่วงเวลา",
            "error": None,
            "last_output": None,
        })
    thread = threading.Thread(
        target=run_night_job,
        args=(job_id, capture_times, valid_separate_channels(separate_channels), duration_seconds),
        daemon=True,
    )
    thread.start()
    return True, job_id


def valid_datetime(date_text, time_text):
    try:
        return datetime.strptime("%s %s" % (date_text, time_text), "%Y-%m-%d %H:%M").replace(tzinfo=LOCAL_TZ)
    except ValueError as exc:
        raise ValueError("วันที่หรือเวลาไม่ถูกต้อง") from exc


def clock_minutes(value, allow_24=False):
    try:
        hour, minute = [int(part) for part in str(value).split(":", 1)]
        if hour == 24 and minute == 0 and allow_24:
            return 1440
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError
        return hour * 60 + minute
    except (ValueError, TypeError):
        raise ValueError("เวลาไม่ถูกต้อง ใช้รูปแบบ HH:MM")


def validate_window_capture(capture_time, window_start, window_end):
    capture_value = clock_minutes(capture_time)
    start_value = clock_minutes(window_start)
    end_value = clock_minutes(window_end, allow_24=True)
    if end_value <= start_value or not (start_value <= capture_value <= end_value):
        raise ValueError("เวลาแคปต้องอยู่ภายในช่วงเวลาที่กำหนด")


def playback_endpoint_status():
    try:
        isapi_request("/ISAPI/System/deviceInfo", timeout=5)
        return True, "พร้อมเชื่อมต่อ NVR ผ่าน ISAPI"
    except (urllib.error.HTTPError, urllib.error.URLError, OSError) as exc:
        return False, "เชื่อมต่อ NVR Playback ผ่าน ISAPI ไม่ได้ (%s:%d): %s" % (ISAPI_HOST, ISAPI_PORT, exc)


def scheduler_loop():
    last_key = None
    while not STOP_EVENT.is_set():
        now = datetime.now(LOCAL_TZ)
        key = now.strftime("%Y-%m-%d %H:%M")
        with STATE_LOCK:
            enabled = STATE["enabled"]
            times = list(STATE["times"])
            separate = list(STATE["separate_channels"])
        if enabled and now.strftime("%H:%M") in times and key != last_key:
            last_key = key
            started, detail = start_job(now.replace(second=0, microsecond=0), False, separate, CAPTURE_DURATION)
            LOGGER.info("ตั้งเวลารอบ %s: %s", key, detail)
        time.sleep(10)


def safe_capture_path(request_path):
    relative = unquote(request_path[len("/captures/"):])
    base = CAPTURES_DIR.resolve()
    candidate = (CAPTURES_DIR / relative).resolve()
    try:
        if os.path.commonpath([str(base), str(candidate)]) != str(base):
            return None
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def capture_url(path):
    relative = path.resolve().relative_to(CAPTURES_DIR.resolve()).as_posix()
    return "/captures/" + quote(relative, safe="/")


def live_stream_command(channel):
    return [
        FFMPEG,
        "-hide_banner",
        "-loglevel", "error",
        "-rtsp_transport", "tcp",
        "-i", live_url(channel),
        "-an",
        "-vf", "fps=5",
        "-q:v", "5",
        "-f", "mpjpeg",
        "-boundary_tag", "ffmpeg",
        "-",
    ]


def playback_stream_command(channel, local_dt, duration_seconds):
    return [
        FFMPEG,
        "-hide_banner",
        "-loglevel", "error",
        "-rtsp_transport", "tcp",
        "-i", historical_recording_url(channel, local_dt, duration_seconds),
        "-an",
        "-t", str(duration_seconds),
        "-vf", "fps=5",
        "-q:v", "5",
        "-f", "mpjpeg",
        "-boundary_tag", "ffmpeg",
        "-",
    ]


def export_url(path):
    relative = path.resolve().relative_to(EXPORTS_DIR.resolve()).as_posix()
    return "/exports/" + quote(relative, safe="/")


def safe_export_path(request_path):
    relative = unquote(request_path[len("/exports/"):])
    base = EXPORTS_DIR.resolve()
    candidate = (EXPORTS_DIR / relative).resolve()
    try:
        if os.path.commonpath([str(base), str(candidate)]) != str(base):
            return None
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def job_manifests(job_id):
    if not job_id or not re.fullmatch(r"[A-Za-z0-9_-]+", str(job_id)):
        return []
    matches = []
    for manifest_path in CAPTURES_DIR.rglob("manifest.json"):
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if str(manifest.get("job_id", "")) == str(job_id):
            matches.append((manifest_path, manifest))
    return sorted(matches, key=lambda item: item[0].parent.as_posix())


def export_job(job_id):
    matches = job_manifests(job_id)
    if not matches:
        raise ValueError("ไม่พบผลลัพธ์ของงานนี้")
    first_manifest = matches[0][0].parent
    export_path = EXPORTS_DIR / ("รอบเวร_%s_%s.zip" % (first_manifest.parent.name, job_id))
    with zipfile.ZipFile(export_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for manifest_path, _manifest in matches:
            batch_dir = manifest_path.parent
            folder = "%s_%s" % (batch_dir.parent.name, batch_dir.name)
            archive.write(manifest_path, "%s/manifest.json" % folder)
            subdir = batch_dir / "รวมกล้อง"
            if subdir.is_dir():
                for image_path in sorted(subdir.glob("*.jpg")):
                    archive.write(image_path, "%s/รวมกล้อง/%s" % (folder, image_path.name))
    return export_path, len(matches)


def list_result_batches(limit=12):
    batches = []
    manifests = sorted(
        CAPTURES_DIR.rglob("manifest.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for manifest_path in manifests[:limit]:
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        batch_dir = manifest_path.parent
        overview_dir = batch_dir / "รวมกล้อง"
        overview_images = sorted(overview_dir.glob("camera-*.jpg"))
        collages = sorted(overview_dir.glob("ภาพรวม-*.jpg"))
        job_id = manifest.get("job_id")
        existing_exports = sorted(EXPORTS_DIR.glob("*_%s.zip" % job_id)) if job_id else []
        batches.append({
            "job_id": job_id,
            "date": batch_dir.parent.name,
            "time": batch_dir.name,
            "mode": manifest.get("mode"),
            "local_datetime": manifest.get("local_datetime"),
            "successful_channels": manifest.get("successful_channels", []),
            "collage": capture_url(collages[0]) if collages else None,
            "export_url": export_url(existing_exports[0]) if existing_exports else None,
            "overview": [{"name": path.name, "url": capture_url(path)} for path in overview_images],
        })
    return batches


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format_string, *args):
        return

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            body = STATIC_INDEX.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path in {"/guide.html", "/guide"}:
            guide_path = ROOT / "static" / "guide.html"
            body = guide_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/status":
            with JOB_LOCK:
                job = dict(JOB)
            with STATE_LOCK:
                state = dict(STATE)
            self.send_json({
                "job": job,
                "schedule": {"enabled": state["enabled"], "times": state["times"], "separate_channels": state["separate_channels"]},
                "channels": CHANNELS,
                "timezone": TIMEZONE_NAME,
                "captures_dir": str(CAPTURES_DIR),
            })
            return
        if parsed.path == "/api/results":
            self.send_json({"batches": list_result_batches()})
            return
        if parsed.path == "/api/live-stream":
            try:
                channel = int(parse_qs(parsed.query).get("channel", [""])[0])
            except (TypeError, ValueError):
                self.send_json({"error": "ระบุหมายเลขกล้องไม่ถูกต้อง"}, 400)
                return
            if channel not in CHANNELS:
                self.send_json({"error": "ไม่พบหมายเลขกล้องนี้"}, 404)
                return
            process = None
            try:
                process = subprocess.Popen(
                    live_stream_command(channel),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=0,
                )
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=ffmpeg")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Connection", "close")
                self.end_headers()
                while True:
                    chunk = process.stdout.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except FileNotFoundError:
                if not self.wfile.closed:
                    self.send_json({"error": "ไม่พบ ffmpeg ตามค่า CCTV_FFMPEG"}, 500)
            except (BrokenPipeError, ConnectionResetError):
                pass
            except OSError:
                pass
            finally:
                if process and process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
            return
        if parsed.path == "/api/playback-stream":
            query = parse_qs(parsed.query)
            try:
                channel = int(query.get("channel", [""])[0])
                local_dt = valid_datetime(query.get("date", [""])[0], query.get("time", [""])[0])
                duration = max(1, min(300, int(query.get("duration", ["60"])[0])))
            except (TypeError, ValueError):
                self.send_json({"error": "ระบุวัน เวลา หรือหมายเลขกล้องไม่ถูกต้อง"}, 400)
                return
            if channel not in CHANNELS:
                self.send_json({"error": "ไม่พบหมายเลขกล้องนี้"}, 404)
                return
            process = None
            try:
                process = subprocess.Popen(
                    playback_stream_command(channel, local_dt, duration),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=0,
                )
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=ffmpeg")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Connection", "close")
                self.end_headers()
                while True:
                    chunk = process.stdout.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except RuntimeError as exc:
                if process:
                    process.kill()
                self.send_json({"error": str(exc)}, 404)
            except FileNotFoundError:
                self.send_json({"error": "ไม่พบ ffmpeg ตามค่า CCTV_FFMPEG"}, 500)
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                if process and process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
            return
        if parsed.path.startswith("/captures/"):
            path = safe_capture_path(parsed.path)
            if not path:
                self.send_error(404)
                return
            content_type = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "application/json"
            body = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path.startswith("/exports/"):
            path = safe_export_path(parsed.path)
            if not path:
                self.send_error(404)
                return
            body = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", "attachment; filename*=UTF-8''%s" % quote(path.name))
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            payload = self.read_json()
            if parsed.path == "/api/capture":
                mode = payload.get("mode", "historical")
                if mode == "live":
                    local_dt = datetime.now(LOCAL_TZ).replace(second=0, microsecond=0)
                    historical = False
                else:
                    local_dt = valid_datetime(payload.get("date", ""), payload.get("time", ""))
                    historical = True
                duration = max(1, int(payload.get("duration_seconds", CAPTURE_DURATION)))
                selected = valid_separate_channels(payload.get("separate_channels", DEFAULT_SEPARATE))
                started, detail = start_job(local_dt, historical, selected, duration)
                self.send_json({"started": started, "detail": detail}, 202 if started else 409)
                return
            if parsed.path == "/api/capture-night":
                night_date = payload.get("date", "")
                first_capture = payload.get("capture_time_1", "23:00")
                second_capture = payload.get("capture_time_2", "04:00")
                window_1_start = payload.get("window_1_start", "22:00")
                window_1_end = payload.get("window_1_end", "24:00")
                window_2_start = payload.get("window_2_start", "03:00")
                window_2_end = payload.get("window_2_end", "06:00")
                validate_window_capture(first_capture, window_1_start, window_1_end)
                validate_window_capture(second_capture, window_2_start, window_2_end)
                first_dt = valid_datetime(night_date, first_capture)
                second_date = (first_dt + timedelta(days=1)).strftime("%Y-%m-%d")
                second_dt = valid_datetime(second_date, second_capture)
                duration = max(1, int(payload.get("duration_seconds", CAPTURE_DURATION)))
                selected = valid_separate_channels(payload.get("separate_channels", DEFAULT_SEPARATE))
                started, detail = start_night_job([first_dt, second_dt], selected, duration)
                self.send_json({"started": started, "detail": detail}, 202 if started else 409)
                return
            if parsed.path == "/api/export":
                export_path, round_count = export_job(payload.get("job_id"))
                self.send_json({
                    "ok": True,
                    "round_count": round_count,
                    "url": export_url(export_path),
                    "path": str(export_path),
                })
                return
            if parsed.path == "/api/cancel":
                with JOB_LOCK:
                    if not JOB["running"]:
                        self.send_json({"cancelled": False, "detail": "ไม่มีงานที่กำลังทำงาน"}, 409)
                        return
                    CANCEL_EVENT.set()
                    JOB["message"] = "กำลังยกเลิกงาน..."
                self.send_json({"cancelled": True})
                return
            if parsed.path == "/api/schedule":
                with STATE_LOCK:
                    STATE["enabled"] = bool(payload.get("enabled", False))
                    STATE["times"] = valid_schedule_times(payload.get("times", STATE["times"]))
                    STATE["separate_channels"] = valid_separate_channels(payload.get("separate_channels", STATE["separate_channels"]))
                    save_state(STATE)
                self.send_json({"ok": True, "state": STATE})
                return
            self.send_error(404)
        except ValueError as exc:
            self.send_json({"error": str(exc)}, 400)
        except Exception as exc:
            LOGGER.exception("API error")
            self.send_json({"error": str(exc)}, 500)


def stop_handler(_signum, _frame):
    STOP_EVENT.set()
    CANCEL_EVENT.set()
    if SERVER is not None:
        threading.Thread(target=SERVER.shutdown, daemon=True).start()


def main():
    global SERVER
    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)
    threading.Thread(target=scheduler_loop, daemon=True).start()
    web_host = os.getenv("CCTV_WEB_HOST", "127.0.0.1")
    web_port = env_int("CCTV_WEB_PORT", 8787)
    server = ThreadingHTTPServer((web_host, web_port), Handler)
    SERVER = server
    LOGGER.info("CCTV UI เปิดที่ http://%s:%d", web_host, web_port)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()
        STOP_EVENT.set()


if __name__ == "__main__":
    main()
