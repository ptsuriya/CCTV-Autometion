import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  FileClock,
  Film,
  Gauge,
  Info,
  LoaderCircle,
  MonitorPlay,
  MoonStar,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  TimerReset,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import BlurText from "./components/BlurText.jsx";
import SpotlightCard from "./components/SpotlightCard.jsx";

const MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const DEFAULT_CHANNELS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 20,
];
const DEFAULT_JOB = {
  running: false,
  progress: 0,
  message: "กำลังเชื่อมต่อ...",
  error: null,
  last_output: null,
};

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeLabel(minutes) {
  const value = Math.max(0, Math.min(1439, Number(minutes) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function thaiResultLabel(batch) {
  const match = String(batch.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const time = String(batch.time || "").replace("-", ":");
  if (!match) return `รอบเวรที่ ${batch.date || "-"} เวลา ${time || "-"}`;
  return `รอบเวรที่ ${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${Number(match[1]) + 543} เวลา ${time}`;
}

function groupBatches(batches) {
  const groups = new Map();
  batches.forEach((batch) => {
    const key = batch.job_id || `${batch.date}-${batch.time}`;
    if (!groups.has(key))
      groups.set(key, { jobId: key, rounds: [], mode: batch.mode });
    groups.get(key).rounds.push(batch);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    rounds: group.rounds.sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
    ),
  }));
}

function getErrorItems(error) {
  if (!error || typeof error !== "object") return [];
  const items = [];
  Object.entries(error).forEach(([round, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.entries(value).forEach(([camera, detail]) =>
        items.push({ round, camera, detail: String(detail) }),
      );
    } else items.push({ round: "", camera: "", detail: String(value) });
  });
  return items;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.detail || data.error || "ทำรายการไม่สำเร็จ");
  return data;
}

function BrandMark({ compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "min-w-0"}`}>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-indigo-200/20 bg-[#10152b] shadow-[0_0_28px_rgba(99,102,241,.25)] sm:h-14 sm:w-14">
        <img
          src="/night-night-cctv.png"
          alt="Night Night CCTV"
          className="h-full w-full object-cover"
        />
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="truncate text-base font-black tracking-tight text-white sm:text-lg">
            Night Night CCTV
          </div>
          <div className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[.18em] text-indigo-200/60">
            Local operations console
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ job }) {
  const noData = !job.running && /^ไม่มีข้อมูลกล้อง/.test(job.message || "");
  const partial = !job.running && job.error && /^เสร็จ/.test(job.message || "");
  const label = job.running
    ? "กำลังทำงาน"
    : noData
      ? "ไม่พบข้อมูล"
      : partial
        ? "เสร็จบางส่วน"
        : job.error
          ? "มีข้อผิดพลาด"
          : "พร้อมทำงาน";
  const styles = job.running
    ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"
    : noData || partial
      ? "border-amber-300/20 bg-amber-400/10 text-amber-200"
      : job.error
        ? "border-rose-300/20 bg-rose-400/10 text-rose-200"
        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${styles}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${job.running ? "animate-pulse bg-cyan-300" : job.error ? "bg-rose-300" : "bg-emerald-300"}`}
      />
      {label}
    </span>
  );
}

function SectionHeading({ eyebrow, title, description, icon: Icon }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-indigo-200/60">
          <Icon size={14} />
          {eyebrow}
        </div>
        <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function App() {
  const [server, setServer] = useState({
    job: DEFAULT_JOB,
    channels: DEFAULT_CHANNELS,
    timezone: "Asia/Bangkok",
    schedule: { enabled: false, times: ["23:00", "04:00"] },
  });
  const [results, setResults] = useState([]);
  const [mode, setMode] = useState("overnight");
  const [scheduleDraft, setScheduleDraft] = useState(["23:00", "04:00"]);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [nightDate, setNightDate] = useState(localDateValue());
  const [capture1, setCapture1] = useState("23:00");
  const [capture2, setCapture2] = useState("04:00");
  const [window1, setWindow1] = useState(["22:00", "23:59"]);
  const [window2, setWindow2] = useState(["03:00", "06:00"]);
  const [duration, setDuration] = useState(60);
  const [liveChannel, setLiveChannel] = useState("");
  const [liveSrc, setLiveSrc] = useState("");
  const [timelineDate, setTimelineDate] = useState(localDateValue());
  const [timelineMinute, setTimelineMinute] = useState(1380);
  const [toast, setToast] = useState(null);
  const [action, setAction] = useState("");
  const [expandedErrors, setExpandedErrors] = useState(false);

  const job = server.job || DEFAULT_JOB;
  const channels = server.channels?.length ? server.channels : DEFAULT_CHANNELS;
  const errors = useMemo(() => getErrorItems(job.error), [job.error]);
  const noData = !job.running && /^ไม่มีข้อมูลกล้อง/.test(job.message || "");

  const refresh = useCallback(async () => {
    try {
      const [status, result] = await Promise.all([
        requestJson("/api/status"),
        requestJson("/api/results"),
      ]);
      setServer(status);
      setResults(result.batches || []);
      if (!scheduleDirty)
        setScheduleDraft(status.schedule.times || ["23:00", "04:00"]);
      if (!liveChannel && status.channels?.length)
        setLiveChannel(String(status.channels[0]));
    } catch (error) {
      setToast({
        type: "error",
        message: `เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ${error.message}`,
      });
    }
  }, [liveChannel, scheduleDirty]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1800);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const runAction = async (name, fn, successMessage) => {
    setAction(name);
    try {
      await fn();
      if (successMessage)
        setToast({ type: "success", message: successMessage });
      await refresh();
    } catch (error) {
      setToast({ type: "error", message: error.message });
    } finally {
      setAction("");
    }
  };

  const saveSchedule = () =>
    runAction(
      "schedule",
      () =>
        requestJson("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: server.schedule.enabled,
            times: scheduleDraft,
          }),
        }).then(() => setScheduleDirty(false)),
      "บันทึกเวลาใหม่แล้ว",
    );
  const toggleSchedule = () =>
    runAction(
      "schedule",
      () =>
        requestJson("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: !server.schedule.enabled,
            times: scheduleDraft,
          }),
        }).then(() => setScheduleDirty(false)),
      server.schedule.enabled ? "หยุดรันข้ามคืนแล้ว" : "เปิดรันข้ามคืนแล้ว",
    );
  const runNight = () =>
    runAction(
      "historical",
      () =>
        requestJson("/api/capture-night", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: nightDate,
            window_1_start: window1[0],
            window_1_end: window1[1],
            capture_time_1: capture1,
            window_2_start: window2[0],
            window_2_end: window2[1],
            capture_time_2: capture2,
            duration_seconds: Number(duration),
          }),
        }),
      "เริ่มค้นหาย้อนหลัง 2 ช่วงเวลาแล้ว",
    );
  const captureLive = () =>
    runAction(
      "live-capture",
      () =>
        requestJson("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "live" }),
        }),
      "เริ่มแคปภาพสดแล้ว",
    );
  const cancelJob = () =>
    runAction(
      "cancel",
      () =>
        requestJson("/api/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      "ส่งคำสั่งยกเลิกแล้ว",
    );

  const startLive = () => {
    if (!liveChannel) return;
    setLiveSrc(
      `/api/live-stream?channel=${encodeURIComponent(liveChannel)}&t=${Date.now()}`,
    );
  };
  const stopLive = () => setLiveSrc("");
  const startPlayback = () => {
    if (!liveChannel || !timelineDate)
      return setToast({
        type: "error",
        message: "กรุณาเลือกกล้องและวันที่ก่อนเปิดย้อนหลัง",
      });
    const time = timeLabel(timelineMinute);
    setLiveSrc(
      `/api/playback-stream?channel=${encodeURIComponent(liveChannel)}&date=${encodeURIComponent(timelineDate)}&time=${encodeURIComponent(time)}&duration=60&t=${Date.now()}`,
    );
  };
  const exportGroup = (jobId) =>
    runAction(
      `export-${jobId}`,
      async () => {
        const data = await requestJson("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: jobId }),
        });
        window.location.href = data.url;
      },
      "กำลังเตรียมชุดไฟล์ส่งงาน",
    );
  const deleteGroup = (jobId) => {
    if (
      !window.confirm(
        "ลบภาพและไฟล์ ZIP ของรอบเวรนี้ทั้งหมดหรือไม่? การลบไม่สามารถย้อนกลับได้",
      )
    )
      return;
    runAction(
      `delete-${jobId}`,
      () =>
        requestJson("/api/delete-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: jobId }),
        }),
      "ลบผลลัพธ์เรียบร้อยแล้ว",
    );
  };

  const tabs = [
    {
      id: "overnight",
      label: "รันข้ามคืน",
      caption: "ตั้งเวลาอัตโนมัติ",
      icon: MoonStar,
    },
    {
      id: "historical",
      label: "บันทึกย้อนหลัง",
      caption: "เลือกวันและรอบเวร",
      icon: FileClock,
    },
    {
      id: "live",
      label: "LIVE CCTV",
      caption: "ดูสดและ Timeline",
      icon: Radio,
    },
  ];

  return (
    <div className="app-shell min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <BrandMark />
          <nav className="flex items-center gap-2" aria-label="เมนูหลัก">
            <a
              href="/guide.html"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-bold text-slate-300 transition hover:border-indigo-300/30 hover:bg-white/[0.08] hover:text-white"
            >
              <Info size={16} />
              คู่มือ
            </a>
            <span className="hidden items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-200 sm:inline-flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              LOCAL WEB BASE
            </span>
          </nav>
        </header>

        {mode === "overnight" && (
          <section className="pb-8 pt-10 lg:pt-16">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.2em] text-indigo-200">
                <Sparkles size={14} />
                night operations console
              </div>
              <BlurText
                text="จัดการภาพกล้องวงจรปิด"
                className="max-w-3xl text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl"
              />
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                เก็บภาพตามเวลา ดูสดจาก NVR และจัดชุดภาพพร้อมส่งงาน
                ในหน้าเดียวที่ออกแบบให้มองสถานะได้ทันที
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => setMode("overnight")}
                  className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl bg-accent px-5 text-sm font-black text-white shadow-[0_14px_32px_rgba(124,58,237,.25)] transition hover:-translate-y-0.5 hover:bg-violet-500"
                >
                  <TimerReset size={18} />
                  ตั้งเวลารัน
                </button>
                <button
                  onClick={() => setMode("live")}
                  className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 text-sm font-black text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/[0.1]"
                >
                  <MonitorPlay size={18} />
                  เปิดภาพสด
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <SpotlightCard className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">
                ช่องภาพรวม
              </span>
              <Camera size={18} className="text-cyan-300" />
            </div>
            <div className="mt-3 font-data text-3xl font-bold text-white">
              {channels.length}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              แคปพร้อมกันในแต่ละรอบ
            </div>
          </SpotlightCard>
          <SpotlightCard className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">
                รอบที่ตั้งไว้
              </span>
              <Clock3 size={18} className="text-violet-300" />
            </div>
            <div className="mt-3 font-data text-2xl font-bold text-white">
              {server.schedule.times?.join(" · ") || "23:00 · 04:00"}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {server.schedule.enabled
                ? "กำลังเปิดรันข้ามคืน"
                : "ยังไม่เปิดใช้งาน"}
            </div>
          </SpotlightCard>
          <SpotlightCard
            className="p-5"
            spotlightColor="rgba(52, 211, 153, .16)"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">
                สถานะระบบ
              </span>
              <Gauge size={18} className="text-emerald-300" />
            </div>
            <div className="mt-3 flex items-center gap-2 text-2xl font-black text-white">
              <span
                className={`h-2.5 w-2.5 rounded-full ${job.running ? "animate-pulse bg-cyan-300" : job.error ? "bg-rose-300" : "bg-emerald-300"}`}
              />
              {job.running
                ? "กำลังทำงาน"
                : noData
                  ? "ไม่พบข้อมูล"
                  : job.error
                    ? "ต้องตรวจสอบ"
                    : "พร้อมทำงาน"}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-300"
                style={{ width: `${job.progress || 0}%` }}
              />
            </div>
          </SpotlightCard>
        </section>

        <section className="glass-panel mt-6 overflow-hidden rounded-[28px]">
          <div className="grid border-b border-white/[0.08] bg-black/10 sm:grid-cols-3">
            {tabs.map(({ id, label, caption, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`group min-h-[76px] cursor-pointer border-b-2 px-4 py-4 text-left transition sm:border-b-0 sm:border-l-2 first:sm:border-l-0 ${mode === id ? "border-indigo-300 bg-indigo-400/10 text-white" : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`rounded-xl p-2 ${mode === id ? "bg-indigo-400/15 text-indigo-200" : "bg-white/[0.06] text-slate-500 group-hover:text-slate-200"}`}
                  >
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-black">{label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {caption}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          {mode === "overnight" && (
            <OvernightPanel
              scheduleDraft={scheduleDraft}
              setScheduleDraft={(value) => {
                setScheduleDraft(value);
                setScheduleDirty(true);
              }}
              scheduleEnabled={server.schedule.enabled}
              scheduleAction={action === "schedule"}
              saveSchedule={saveSchedule}
              toggleSchedule={toggleSchedule}
              captureLive={captureLive}
            />
          )}
          {mode === "historical" && (
            <HistoricalPanel
              nightDate={nightDate}
              setNightDate={setNightDate}
              capture1={capture1}
              setCapture1={setCapture1}
              capture2={capture2}
              setCapture2={setCapture2}
              window1={window1}
              setWindow1={setWindow1}
              window2={window2}
              setWindow2={setWindow2}
              duration={duration}
              setDuration={setDuration}
              onRun={runNight}
              busy={action === "historical"}
            />
          )}
          {mode === "live" && (
            <LivePanel
              channels={channels}
              liveChannel={liveChannel}
              setLiveChannel={setLiveChannel}
              liveSrc={liveSrc}
              startLive={startLive}
              stopLive={stopLive}
              timelineDate={timelineDate}
              setTimelineDate={setTimelineDate}
              timelineMinute={timelineMinute}
              setTimelineMinute={setTimelineMinute}
              startPlayback={startPlayback}
            />
          )}
        </section>

        <section className="glass-panel mt-6 rounded-[28px] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-slate-500">
                <Activity size={14} />
                งานล่าสุด
              </div>
              <h2 className="text-xl font-black text-white">สถานะการทำงาน</h2>
              <p className="mt-1 text-sm text-slate-400">
                ระบบแยกสถานะ “ไม่มีข้อมูล” ออกจาก Error ของกล้องอย่างชัดเจน
              </p>
            </div>
            <StatusPill job={job} />
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300 transition-all duration-300"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={cancelJob}
              disabled={!job.running || action === "cancel"}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-rose-500/90 px-4 text-sm font-black text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={16} />
              {action === "cancel" ? "กำลังยกเลิก..." : "ยกเลิกงาน"}
            </button>
            <span className="font-data text-xs text-slate-500">
              {job.progress || 0}%
            </span>
            <span className="text-sm text-slate-400">{job.message}</span>
          </div>
          {errors.length > 0 && (
            <div
              className="mt-5 rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] p-4"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <CircleAlert
                  className="mt-0.5 shrink-0 text-rose-300"
                  size={18}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-rose-100">
                    มีปัญหาเฉพาะบางกล้อง
                  </div>
                  <p className="mt-1 text-sm leading-6 text-rose-100/70">
                    ระบบยังทำงานส่วนอื่นต่อได้ ตรวจพบ {errors.length}{" "}
                    รายการที่ต้องตรวจสอบ
                  </p>
                  <button
                    onClick={() => setExpandedErrors((value) => !value)}
                    className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-rose-200/20 px-3 text-xs font-bold text-rose-100 transition hover:bg-rose-200/10"
                  >
                    {expandedErrors ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                    <ChevronDown
                      className={`transition-transform ${expandedErrors ? "rotate-180" : ""}`}
                      size={14}
                    />
                  </button>
                  {expandedErrors && (
                    <div className="mt-3 space-y-2 border-t border-rose-200/10 pt-3">
                      {errors.slice(0, 24).map((item, index) => (
                        <div
                          key={`${item.round}-${item.camera}-${index}`}
                          className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-rose-100/75"
                        >
                          <span className="font-data text-rose-200">
                            กล้อง {item.camera || "-"}
                          </span>
                          <span>{item.round}</span>
                          <span>{item.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {noData && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-4 text-sm leading-6 text-amber-100/80">
              <Info className="mt-1 shrink-0 text-amber-300" size={18} />
              <span>
                ไม่มีข้อมูลกล้องวงจรปิดในวันที่เลือก หากต้องการยืนยัน ให้ตรวจ
                Timeline ใน NVR โดยตรง
              </span>
            </div>
          )}
        </section>

        <ResultsSection
          results={results}
          onExport={exportGroup}
          onDelete={deleteGroup}
          action={action}
          onRefresh={refresh}
        />
      </div>
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-xl ${toast.type === "error" ? "border-rose-300/20 bg-rose-950/90 text-rose-100" : "border-emerald-300/20 bg-emerald-950/90 text-emerald-100"}`}
          role="status"
        >
          <span
            className={`rounded-full p-1 ${toast.type === "error" ? "bg-rose-300/15" : "bg-emerald-300/15"}`}
          >
            {toast.type === "error" ? (
              <XCircle size={16} />
            ) : (
              <Check size={16} />
            )}
          </span>
          {toast.message}
          <button
            aria-label="ปิดการแจ้งเตือน"
            onClick={() => setToast(null)}
            className="ml-2 cursor-pointer text-current/60 hover:text-current"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "time",
  helper,
  className = "",
  options = [],
}) {
  const controlClass =
    "min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm font-bold text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10";
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[.14em] text-slate-500">
        {label}
      </span>
      {type === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
        />
      )}
      {helper && (
        <span className="mt-1.5 block text-xs text-slate-500">{helper}</span>
      )}
    </label>
  );
}

function OvernightPanel({
  scheduleDraft,
  setScheduleDraft,
  scheduleEnabled,
  scheduleAction,
  saveSchedule,
  toggleSchedule,
  captureLive,
}) {
  const update = (index, value) =>
    setScheduleDraft(
      scheduleDraft.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    );
  return (
    <div className="p-5 sm:p-8">
      <SectionHeading
        eyebrow="automation"
        title="ตั้งเวลารันข้ามคืน"
        description="ตั้งเวลาเองได้ 2 รอบ แล้วปล่อยเครื่องทำงานต่อเนื่อง ระบบจะใช้เวลาที่บันทึกไว้กับ Scheduler"
        icon={MoonStar}
      />
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-indigo-300/15 bg-indigo-400/[0.06] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-black text-indigo-100">รอบที่ 1</span>
            <span className="font-data text-xs text-indigo-200/60">
              ตั้งเวลาได้อิสระ
            </span>
          </div>
          <InputField
            label="เวลาที่จะจับภาพ"
            value={scheduleDraft[0]}
            onChange={(value) => update(0, value)}
          />
        </div>
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-black text-cyan-100">รอบที่ 2</span>
            <span className="font-data text-xs text-cyan-200/60">
              ตั้งเวลาได้อิสระ
            </span>
          </div>
          <InputField
            label="เวลาที่จะจับภาพ"
            value={scheduleDraft[1]}
            onChange={(value) => update(1, value)}
          />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={saveSchedule}
          disabled={scheduleAction}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-500 px-5 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} />
          {scheduleAction ? "กำลังบันทึก..." : "บันทึกเวลา"}
        </button>
        <button
          onClick={toggleSchedule}
          disabled={scheduleAction}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${scheduleEnabled ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"}`}
        >
          {scheduleEnabled ? <Pause size={16} /> : <Play size={16} />}
          {scheduleEnabled ? "หยุดรันข้ามคืน" : "เปิดรันข้ามคืน"}
        </button>
        <button
          onClick={captureLive}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.1]"
        >
          <Camera size={16} />
          ทดสอบแคปสดตอนนี้
        </button>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-black/10 p-4 text-sm leading-6 text-slate-400">
        <Settings2 className="mt-1 shrink-0 text-indigo-300" size={17} />
        <span>
          แก้เวลาแล้วกด <b className="text-slate-200">บันทึกเวลา</b> ก่อนเปิดรัน
          ระบบจะไม่ทับค่าที่กำลังแก้ไขจากการรีเฟรชสถานะ
        </span>
      </div>
    </div>
  );
}

function HistoricalPanel({
  nightDate,
  setNightDate,
  capture1,
  setCapture1,
  capture2,
  setCapture2,
  window1,
  setWindow1,
  window2,
  setWindow2,
  duration,
  setDuration,
  onRun,
  busy,
}) {
  return (
    <div className="p-5 sm:p-8">
      <SectionHeading
        eyebrow="nvr playback"
        title="บันทึกย้อนหลังแบบข้ามคืน"
        description="เลือกวันเริ่มต้น ระบบจะค้นหารอบที่ 1 ในวันนั้น และรอบที่ 2 ในวันถัดไป ตามช่วงเวลาที่กำหนด"
        icon={FileClock}
      />
      <div className="mt-7 grid gap-4 sm:grid-cols-[1fr_190px]">
        <InputField
          label="วันบันทึก / วันเริ่มต้น"
          type="date"
          value={nightDate}
          onChange={setNightDate}
          helper="รอบ 04:00 จะอยู่ในวันถัดไป"
        />
        <InputField
          label="ค้นหาเผื่อ (วินาที)"
          type="number"
          value={duration}
          onChange={setDuration}
          helper="ค่าแนะนำ 60 วินาที"
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <WindowCard
          title="ช่วงที่ 1 · วันเริ่มต้น"
          tone="indigo"
          range="22:00–24:00"
          start={window1[0]}
          end={window1[1]}
          capture={capture1}
          setStart={(value) => setWindow1([value, window1[1]])}
          setEnd={(value) => setWindow1([window1[0], value])}
          setCapture={setCapture1}
        />
        <WindowCard
          title="ช่วงที่ 2 · วันถัดไป"
          tone="cyan"
          range="03:00–06:00"
          start={window2[0]}
          end={window2[1]}
          capture={capture2}
          setStart={(value) => setWindow2([value, window2[1]])}
          setEnd={(value) => setWindow2([window2[0], value])}
          setCapture={setCapture2}
        />
      </div>
      <button
        onClick={onRun}
        disabled={busy}
        className="mt-6 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-400/20 transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={18} />
        ) : (
          <RotateCcw size={18} />
        )}
        {busy ? "กำลังเริ่มงาน..." : "บันทึกย้อนหลัง 2 ช่วงเวลา"}
      </button>
    </div>
  );
}

function WindowCard({
  title,
  tone,
  range,
  start,
  end,
  capture,
  setStart,
  setEnd,
  setCapture,
}) {
  const border =
    tone === "indigo"
      ? "border-indigo-300/15 bg-indigo-400/[0.06]"
      : "border-cyan-300/15 bg-cyan-400/[0.06]";
  return (
    <div className={`rounded-2xl border p-5 ${border}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-black text-white">{title}</h3>
        <span className="font-data text-xs text-slate-400">{range}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <InputField label="เริ่ม" value={start} onChange={setStart} />
        <InputField label="แคปเวลา" value={capture} onChange={setCapture} />
        <InputField label="สิ้นสุด" value={end} onChange={setEnd} />
      </div>
    </div>
  );
}

function LivePanel({
  channels,
  liveChannel,
  setLiveChannel,
  liveSrc,
  startLive,
  stopLive,
  timelineDate,
  setTimelineDate,
  timelineMinute,
  setTimelineMinute,
  startPlayback,
}) {
  const progress = (timelineMinute / 1439) * 100;
  const quickTimes = [1320, 1380, 0, 240, 360];
  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          eyebrow="live monitor"
          title="ดูภาพสดและ Timeline"
          description="เลือกกล้องเพื่อดูสด หรือเลือกจุดเวลาใน NVR เพื่อเปิดย้อนหลังช่วง 1 นาที"
          icon={Radio}
        />
        <span className="inline-flex h-fit items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1.5 text-xs font-bold text-rose-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />
          LIVE STREAM
        </span>
      </div>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-end">
        <InputField
          label="เลือกกล้อง"
          type="select"
          value={liveChannel}
          onChange={setLiveChannel}
          options={channels.map((channel) => ({
            value: String(channel),
            label: `กล้อง ${String(channel).padStart(2, "0")}`,
          }))}
          className="flex-1"
        />
        <button
          onClick={startLive}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 text-sm font-black text-white transition hover:bg-rose-400"
        >
          <Play size={16} />
          เปิดภาพสด
        </button>
        <button
          onClick={stopLive}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.1]"
        >
          <Square size={14} />
          หยุด
        </button>
      </div>
      <div className="mt-5 flex min-h-[280px] items-center justify-center overflow-hidden rounded-3xl border border-white/[0.08] bg-black shadow-2xl">
        {liveSrc ? (
          <img
            src={liveSrc}
            alt={`ภาพจากกล้อง ${liveChannel}`}
            className="max-h-[520px] min-h-[280px] w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center text-slate-500">
            <Film size={32} />
            <span>เลือกกล้องแล้วกด “เปิดภาพสด”</span>
          </div>
        )}
      </div>
      <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-slate-900 via-slate-900/95 to-cyan-950/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
              <h3 className="text-lg font-black text-white">Timeline กล้อง</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              เลือกจุดเวลาใน NVR แล้วเปิดดูย้อนหลัง 1 นาที
            </p>
          </div>
          <span className="rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-bold text-indigo-200">
            {timelineDate} · {timeLabel(timelineMinute)}
          </span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[210px_1fr_auto] lg:items-end">
          <InputField
            label="วันที่ค้นหา"
            type="date"
            value={timelineDate}
            onChange={setTimelineDate}
          />
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[.18em] text-slate-500">
                เวลาใน NVR
              </span>
              <span className="rounded-lg bg-cyan-300/10 px-2.5 py-1 font-data text-lg font-bold text-cyan-200">
                {timeLabel(timelineMinute)}
              </span>
            </div>
            <input
              aria-label="เลือกเวลาใน NVR"
              type="range"
              min="0"
              max="1439"
              value={timelineMinute}
              onChange={(event) =>
                setTimelineMinute(Number(event.target.value))
              }
              style={{ "--timeline-progress": `${progress}%` }}
              className="timeline-range"
            />
            <div className="mt-2 grid grid-cols-5 font-data text-[10px] font-bold text-slate-500">
              <span>00:00</span>
              <span className="text-center">06:00</span>
              <span className="text-center">12:00</span>
              <span className="text-center">18:00</span>
              <span className="text-right">24:00</span>
            </div>
          </div>
          <button
            onClick={startPlayback}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-400"
          >
            <Eye size={17} />
            เปิดย้อนหลังจุดนี้
          </button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">
            เลือกเร็ว
          </span>
          {quickTimes.map((value) => (
            <button
              key={value}
              onClick={() => setTimelineMinute(value)}
              className={`timeline-quick min-h-10 cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-200 ${timelineMinute === value ? "active" : ""}`}
            >
              {timeLabel(value)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultsSection({ results, onExport, onDelete, action, onRefresh }) {
  const groups = groupBatches(results);
  return (
    <section className="mt-6 rounded-[28px] border border-white/[0.08] bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-slate-500">
            <Archive size={14} />
            delivery queue
          </div>
          <h2 className="text-xl font-black text-white">ผลลัพธ์ภาพ</h2>
          <p className="mt-1 text-sm text-slate-400">
            ภาพรวมและภาพกล้องทั้งหมดอยู่ในโฟลเดอร์{" "}
            <span className="font-data text-indigo-200">รวมกล้อง</span> เดียวกัน
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          <RefreshCw size={16} />
          รีเฟรชผลลัพธ์
        </button>
      </div>
      {!groups.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          ยังไม่มีผลลัพธ์ภาพ
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {groups.map((group) => (
            <article
              key={group.jobId}
              className="overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/30"
            >
              <div className="flex flex-col gap-3 border-b border-white/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <div className="text-sm font-black text-white">
                    {group.rounds.length > 1 ? "รอบเวรเดียวกัน" : "ผลลัพธ์ภาพ"}
                  </div>
                  <div className="mt-1 text-sm text-indigo-200">
                    {group.rounds.map(thaiResultLabel).join(" และ ")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.rounds.some((batch) => batch.export_url) ? (
                    <a
                      href={
                        group.rounds.find((batch) => batch.export_url).export_url
                      }
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-black text-slate-950"
                    >
                      <Download size={15} />
                      ดาวน์โหลดชุดนี้
                    </a>
                  ) : (
                    group.jobId && (
                      <button
                        onClick={() => onExport(group.jobId)}
                        disabled={action === `export-${group.jobId}`}
                        className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
                      >
                        {action === `export-${group.jobId}` ? (
                          <LoaderCircle className="animate-spin" size={15} />
                        ) : (
                          <Archive size={15} />
                        )}
                        รวมชุดส่งงาน
                      </button>
                    )
                  )}
                  {group.jobId && (
                    <button
                      onClick={() => onDelete(group.jobId)}
                      disabled={action === `delete-${group.jobId}`}
                      className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 text-xs font-black text-rose-200 transition hover:border-rose-300/35 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {action === `delete-${group.jobId}` ? (
                        <LoaderCircle className="animate-spin" size={15} />
                      ) : (
                        <Trash2 size={15} />
                      )}
                      {action === `delete-${group.jobId}`
                        ? "กำลังลบ..."
                        : "ลบชุดนี้"}
                    </button>
                  )}
                </div>
              </div>
              {group.rounds.map((batch) => (
                <div
                  key={`${batch.date}-${batch.time}`}
                  className="border-b border-white/[0.08] p-4 last:border-b-0 sm:p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-bold text-cyan-100">
                      {thaiResultLabel(batch)}
                    </span>
                    {batch.collage && (
                      <a
                        href={batch.collage}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-500 px-3 text-xs font-bold text-white transition hover:bg-indigo-400"
                      >
                        <Eye size={15} />
                        เปิดภาพรวม
                      </a>
                    )}
                  </div>
                  {batch.collage ? (
                    <a
                      href={batch.collage}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-2xl border border-white/10 bg-black"
                    >
                      <img
                        src={batch.collage}
                        loading="lazy"
                        alt={`ภาพรวม ${thaiResultLabel(batch)}`}
                        className="max-h-[520px] w-full object-contain"
                      />
                    </a>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                      ไม่มีภาพรวม
                    </div>
                  )}
                  <div className="mb-3 mt-5 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[.15em] text-slate-500">
                      ภาพกล้องทั้งหมด
                    </span>
                    <span className="font-data text-xs text-slate-400">
                      {batch.overview?.length || 0} /{" "}
                      {batch.successful_channels?.length || 0} ช่อง
                    </span>
                  </div>
                  {batch.overview?.length ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {batch.overview.map((image) => (
                        <a
                          key={image.url}
                          href={image.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-cyan-300/30"
                        >
                          <img
                            src={image.url}
                            loading="lazy"
                            alt={image.name}
                            className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                          <span className="block truncate px-3 py-2 text-xs text-slate-400">
                            {image.name}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                      ไม่มีภาพกล้อง
                    </div>
                  )}
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default App;
