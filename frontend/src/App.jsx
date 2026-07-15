import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Archive,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  FileClock,
  Film,
  Gauge,
  Info,
  LayoutGrid,
  LoaderCircle,
  Maximize2,
  Minimize2,
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
import {
  BrandMark,
  InputField,
  SectionHeading,
  StatusPill,
} from "./components/AppPrimitives.jsx";
import {
  groupBatches,
  localDateValue,
  localTimeMinutes,
  thaiDateLabel,
  thaiResultLabel,
  timeLabel,
} from "./utils/date.js";
import { getErrorItems, requestJson } from "./utils/api.js";

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

function App() {
  const [server, setServer] = useState({
    job: DEFAULT_JOB,
    channels: DEFAULT_CHANNELS,
    timezone: "Asia/Bangkok",
    schedule: { enabled: false, times: ["23:00", "04:00"] },
  });
  const [results, setResults] = useState([]);
  const [mode, setMode] = useState("live");
  const [scheduleDraft, setScheduleDraft] = useState(["23:00", "04:00"]);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [nightDate, setNightDate] = useState(localDateValue());
  const [capture1, setCapture1] = useState("23:00");
  const [capture2, setCapture2] = useState("04:00");
  const [window1, setWindow1] = useState(["22:00", "23:59"]);
  const [window2, setWindow2] = useState(["03:00", "06:00"]);
  const [duration, setDuration] = useState(60);
  const [liveChannel, setLiveChannel] = useState("all");
  const [liveSrc, setLiveSrc] = useState("");
  const [wallMode, setWallMode] = useState("");
  const [wallToken, setWallToken] = useState(0);
  const [timelineDate, setTimelineDate] = useState(localDateValue());
  const [timelineMinute, setTimelineMinute] = useState(() =>
    localTimeMinutes(),
  );
  const [playbackTarget, setPlaybackTarget] = useState(null);
  const [liveNow, setLiveNow] = useState(() => new Date());
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
    } catch (error) {
      setToast({
        type: "error",
        message: `เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ${error.message}`,
      });
    }
  }, [liveChannel, scheduleDirty]);

  useEffect(() => {
    if (wallMode) return undefined;
    refresh();
    const timer = setInterval(refresh, 1800);
    return () => clearInterval(timer);
  }, [refresh, wallMode]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = setInterval(() => setLiveNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    if (liveChannel === "all") return startAllLive();
    setPlaybackTarget(null);
    setWallMode("");
    setLiveSrc(
      `/api/live-stream?channel=${encodeURIComponent(liveChannel)}&t=${Date.now()}`,
    );
  };
  const startAllLive = () => {
    if (!channels.length) return;
    setPlaybackTarget(null);
    setLiveSrc("");
    setWallToken(Date.now());
    setWallMode("live");
  };
  const stopLive = () => {
    setLiveSrc("");
    setWallMode("");
  };
  const startPlayback = () => {
    if (liveChannel === "all") return startAllPlayback();
    if (!liveChannel || !timelineDate)
      return setToast({
        type: "error",
        message: "กรุณาเลือกกล้องและวันที่ก่อนเปิดย้อนหลัง",
      });
    const time = timeLabel(timelineMinute);
    setPlaybackTarget({ date: timelineDate, time });
    setWallMode("");
    setLiveSrc(
      `/api/playback-stream?channel=${encodeURIComponent(liveChannel)}&date=${encodeURIComponent(timelineDate)}&time=${encodeURIComponent(time)}&duration=60&t=${Date.now()}`,
    );
  };
  const startAllPlayback = () => {
    if (!timelineDate)
      return setToast({
        type: "error",
        message: "กรุณาเลือกวันที่ก่อนเปิดย้อนหลังทุกกล้อง",
      });
    const time = timeLabel(timelineMinute);
    setPlaybackTarget({ date: timelineDate, time });
    setLiveSrc("");
    setWallToken(Date.now());
    setWallMode("playback");
  };
  const goLiveNow = () => {
    setTimelineDate(localDateValue(liveNow));
    setTimelineMinute(localTimeMinutes(liveNow));
    startLive();
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
  const updateTimelineDate = (value) => setTimelineDate(value);
  const updateTimelineMinute = (value) => setTimelineMinute(Number(value));

  const tabs = [
    {
      id: "live",
      label: "LIVE CCTV",
      caption: "ดูสดและ Timeline",
      icon: Radio,
    },
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
  ];

  return (
    <div className="app-shell min-h-screen overflow-x-hidden">
      <a className="skip-link" href="#main-content">
        ข้ามไปเนื้อหาหลัก
      </a>
      <div className="mx-auto max-w-[1840px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8 2xl:px-10">
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
            <a
              href="https://arit-cctv.rbru.ac.th/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/20"
            >
              ส่งงาน
              <ArrowUpRight size={16} />
            </a>
            <span className="hidden items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-200 sm:inline-flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              LOCAL WEB BASE
            </span>
          </nav>
        </header>

        <main id="main-content">
          {mode === "overnight" && (
            <section className="pb-8 pt-10 lg:pt-16">
              <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
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
                <div className="relative mx-auto w-full max-w-[270px] lg:mr-2 lg:max-w-[300px]">
                  <div className="absolute inset-4 rounded-full bg-indigo-500/20 blur-3xl" />
                  <div className="relative overflow-hidden rounded-[32px] border border-indigo-200/20 bg-[#10152b]/70 p-4 shadow-[0_20px_70px_rgba(79,70,229,.24)] backdrop-blur-xl">
                    <img
                      src="/night-night-cctv.png"
                      alt="Night Night CCTV logo"
                      width="300"
                      height="300"
                      className="aspect-square w-full rounded-[24px] object-cover"
                    />
                    <div className="mt-3 text-center text-[10px] font-bold uppercase tracking-[.22em] text-indigo-200/60">
                      Night operations console
                    </div>
                  </div>
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
                detailPort={server.detail_port}
                liveChannel={liveChannel}
                setLiveChannel={setLiveChannel}
                liveSrc={liveSrc}
                startLive={startLive}
                stopLive={stopLive}
                wallMode={wallMode}
                wallToken={wallToken}
                timelineDate={timelineDate}
                setTimelineDate={updateTimelineDate}
                timelineMinute={timelineMinute}
                setTimelineMinute={updateTimelineMinute}
                playbackTarget={playbackTarget}
                liveNowMinute={localTimeMinutes(liveNow)}
                isLiveDate={timelineDate === localDateValue(liveNow)}
                goLiveNow={goLiveNow}
                startPlayback={startPlayback}
                captureLive={captureLive}
                captureAction={action === "live-capture"}
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
        </main>
      </div>
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-xl ${toast.type === "error" ? "border-rose-300/20 bg-rose-950/90 text-rose-100" : "border-emerald-300/20 bg-emerald-950/90 text-emerald-100"}`}
          role="status"
          aria-live="polite"
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

function FullscreenWallPortal({ active, children }) {
  // A fixed element inside the animated page shell still inherits its visual
  // bounds in some browsers. Moving only the fullscreen wall to <body> keeps
  // the viewport truly edge-to-edge without duplicating the live streams.
  if (!active) return children;
  return createPortal(children, document.body);
}

function LivePanel({
  channels,
  detailPort,
  liveChannel,
  setLiveChannel,
  liveSrc,
  startLive,
  stopLive,
  wallMode,
  wallToken,
  timelineDate,
  setTimelineDate,
  timelineMinute,
  setTimelineMinute,
  playbackTarget,
  liveNowMinute,
  isLiveDate,
  goLiveNow,
  startPlayback,
  captureLive,
  captureAction,
}) {
  const wallRef = useRef(null);
  const wallSessionPrefix = useRef(
    `wall_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  ).current;
  const fullscreenLayoutRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [readyGroups, setReadyGroups] = useState([]);
  const [failedGroups, setFailedGroups] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [isSwitchingFullscreen, setIsSwitchingFullscreen] = useState(false);
  const [isStartingLive, setIsStartingLive] = useState(false);
  const [detailToken, setDetailToken] = useState(0);
  const [detailFrameReady, setDetailFrameReady] = useState(false);
  const [detailPreview, setDetailPreview] = useState("");
  const [wallResumeToken, setWallResumeToken] = useState(0);
  const wallPreviewsRef = useRef(new Map());
  const progress = (timelineMinute / 1439) * 100;
  const liveProgress = (liveNowMinute / 1439) * 100;
  const quickTimes = [1320, 1380, 0, 240, 360];
  const viewingAll = liveChannel === "all";
  const wallRequestToken = `${wallToken}-${wallResumeToken}`;
  const wallSessionId = `${wallSessionPrefix}_${wallRequestToken}`;
  const isLiveViewing = wallMode === "live" || Boolean(liveSrc);
  // In the normal page we keep six 3-camera streams to start quickly.  In
  // fullscreen, five 4-camera rows use the available height more naturally.
  const wallColumns = isFullscreen ? 4 : 3;
  const wallGroups = Array.from(
    { length: Math.ceil(channels.length / wallColumns) },
    (_, index) =>
      channels.slice(index * wallColumns, index * wallColumns + wallColumns),
  );
  const playbackTileCount = channels.length;
  const activeWallUnitCount =
    wallMode === "playback" ? playbackTileCount : wallGroups.length;
  const allStreamsReady =
    activeWallUnitCount > 0 && readyGroups.length === activeWallUnitCount;
  const settledGroupCount = new Set([...readyGroups, ...failedGroups]).size;
  const isPlaybackLoading =
    wallMode === "playback" && settledGroupCount < playbackTileCount;
  const playbackHasNoMatches =
    wallMode === "playback" &&
    settledGroupCount === playbackTileCount &&
    readyGroups.length === 0;
  const wallLabel =
    wallMode === "playback" ? "ย้อนหลังทุกกล้อง" : "ภาพสดทุกกล้อง";
  const wallStreamUrl = (group) =>
    `/api/wall-stream?mode=live&channels=${encodeURIComponent(group.join(","))}&columns=${wallColumns}&session=${wallSessionId}&t=${wallRequestToken}`;
  const playbackFrameUrl = (channel) =>
    `/api/camera-frame?mode=playback&channel=${channel}&date=${encodeURIComponent(playbackTarget?.date || timelineDate)}&time=${encodeURIComponent(playbackTarget?.time || timeLabel(timelineMinute))}&duration=60&t=${wallRequestToken}`;
  const detailFrameBase =
    detailPort &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname)
      ? `${window.location.protocol}//${window.location.hostname}:${detailPort}`
      : "";
  // Wall images keep six HTTP connections open to the main server.  Send
  // lifecycle commands to the lightweight detail listener instead, so a
  // fullscreen switch can always release those six connections immediately.
  const wallControlBase = detailFrameBase;
  const wallControlOptions = useMemo(
    () =>
      wallControlBase
        ? { method: "POST", cache: "no-store", keepalive: true, mode: "no-cors" }
        : { method: "POST", cache: "no-store", keepalive: true },
    [wallControlBase],
  );
  const wallControlEndpoint = useMemo(
    () =>
      `${wallControlBase}/api/wall-session/close?session=${encodeURIComponent(wallSessionId)}`,
    [wallControlBase, wallSessionId],
  );
  const detailImageUrl = selectedCamera && detailFrameReady
    ? wallMode === "playback"
      ? `${detailFrameBase}${playbackFrameUrl(selectedCamera)}`
      : `${detailFrameBase}/api/live-stream?channel=${selectedCamera}&t=${detailToken}`
    : "";
  const selectedCameraIndex = channels.indexOf(selectedCamera);
  const selectedCameraLabel = selectedCamera
    ? `กล้อง ${String(selectedCamera).padStart(2, "0")}`
    : "";
  const cacheWallPreviews = useCallback((image, group) => {
    if (!image?.naturalWidth || !image?.naturalHeight || !group.length) return;
    const tileWidth = Math.floor(image.naturalWidth / wallColumns);
    if (!tileWidth) return;

    group.forEach((channel, index) => {
      if (wallPreviewsRef.current.has(channel)) return;
      const canvas = document.createElement("canvas");
      canvas.width = tileWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(
        image,
        index * tileWidth,
        0,
        tileWidth,
        image.naturalHeight,
        0,
        0,
        tileWidth,
        image.naturalHeight,
      );
      wallPreviewsRef.current.set(channel, canvas.toDataURL("image/jpeg", 0.84));
    });
  }, [wallColumns]);
  const releaseWallSession = useCallback(() => {
    // sendBeacon is the most reliable path during reload/pagehide, including
    // the local detail port. It prevents a half-closed wall from consuming a
    // decoder slot when the user immediately opens all cameras again.
    if (navigator.sendBeacon?.(wallControlEndpoint)) {
      return;
    }
    fetch(wallControlEndpoint, wallControlOptions).catch(() => {});
  }, [wallControlEndpoint, wallControlOptions]);
  const stopWallSession = useCallback(async () => {
    try {
      await Promise.race([
        fetch(wallControlEndpoint, wallControlOptions),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    } catch {
      // The viewer will still create a fresh session. The server also cleans
      // up a disconnected stream in its request-finally handler.
    }
  }, [wallControlEndpoint, wallControlOptions]);
  const restartLiveWall = async () => {
    if (isStartingLive) return;
    setIsStartingLive(true);
    try {
      // Ensure the six old MJPEG decoders have released their slots before a
      // new all-camera wall is mounted. Otherwise the new wall can stay at 0/6.
      if (wallMode) await stopWallSession();
      startLive();
    } finally {
      setIsStartingLive(false);
    }
  };
  const stopLiveWall = () => {
    releaseWallSession();
    stopLive();
  };
  const applyFullscreenLayout = useCallback((nextFullscreen) => {
    if (fullscreenLayoutRef.current === nextFullscreen) return;
    fullscreenLayoutRef.current = nextFullscreen;
    setIsFullscreen(nextFullscreen);
    // A layout switch changes the grouping (6 × 3 ⇄ 5 × 4), so give every
    // MJPEG image a fresh session URL after the prior group has been stopped.
    setWallResumeToken(Date.now());
  }, []);
  const openCameraDetail = (channel) => {
    // Show the cached wall tile immediately. The full-resolution request waits
    // for the NVR wall session to close, avoiding a decoder/connection race.
    setDetailPreview(wallPreviewsRef.current.get(channel) || "");
    setDetailFrameReady(false);
    setSelectedCamera(channel);
    void stopWallSession().finally(() => {
      setDetailToken(Date.now());
      setDetailFrameReady(true);
    });
  };
  const closeCameraDetail = useCallback(() => {
    setSelectedCamera(null);
    setDetailFrameReady(false);
    setDetailPreview("");
    // The old streams were intentionally cancelled for the detail view.
    // Start a fresh wall session instead of retaining their cancellation errors.
    setWallResumeToken(Date.now());
  }, []);
  const moveCameraDetail = (direction) => {
    if (selectedCameraIndex < 0) return;
    const nextIndex =
      (selectedCameraIndex + direction + channels.length) % channels.length;
    const nextChannel = channels[nextIndex];
    setDetailPreview(wallPreviewsRef.current.get(nextChannel) || "");
    setDetailFrameReady(true);
    setSelectedCamera(nextChannel);
  };
  const toggleFullscreen = async () => {
    if (!wallRef.current) return;
    setIsSwitchingFullscreen(true);
    // Fullscreen changes the wall from six 3-camera streams to five
    // 4-camera streams. Stop the old session first; otherwise it occupies all
    // server stream workers and the new wall remains stuck at 0/5.
    await stopWallSession();
    const enterFullscreen = !fullscreenLayoutRef.current;
    if (!enterFullscreen && document.fullscreenElement) {
      const exit = document.exitFullscreen();
      if (exit?.catch) exit.catch(() => {});
    }
    applyFullscreenLayout(enterFullscreen);
    setIsSwitchingFullscreen(false);

    // Render the portal first, then ask for native fullscreen on the new
    // element. The edge-to-edge portal remains the reliable fallback for
    // embedded browsers that decline the Fullscreen API.
    if (enterFullscreen) {
      window.requestAnimationFrame(() => {
        const request = wallRef.current?.requestFullscreen?.();
        if (request?.catch) request.catch(() => {});
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeFullscreen = document.fullscreenElement === wallRef.current;
      if (nativeFullscreen) {
        applyFullscreenLayout(true);
      } else if (fullscreenLayoutRef.current) {
        // Esc exits native fullscreen without clicking our button. Close the
        // active 5-row session before rebuilding the normal 6-row wall.
        void stopWallSession().finally(() => applyFullscreenLayout(false));
      }
      setIsSwitchingFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [applyFullscreenLayout, stopWallSession]);

  useEffect(() => {
    const closeWallSession = () => {
      releaseWallSession();
    };
    window.addEventListener("pagehide", closeWallSession);
    return () => {
      window.removeEventListener("pagehide", closeWallSession);
      closeWallSession();
    };
  }, [releaseWallSession]);

  useEffect(() => {
    if (!wallMode) releaseWallSession();
  }, [releaseWallSession, wallMode]);

  useEffect(() => {
    setReadyGroups([]);
    setFailedGroups([]);
    setSelectedCamera(null);
    setDetailFrameReady(false);
    setDetailPreview("");
    wallPreviewsRef.current.clear();
  }, [wallMode, wallRequestToken]);

  useEffect(() => {
    if (!selectedCamera && !isFullscreen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isFullscreen, selectedCamera]);

  useEffect(() => {
    if (!selectedCamera) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeCameraDetail();
      if (event.key === "ArrowLeft") moveCameraDetail(-1);
      if (event.key === "ArrowRight") moveCameraDetail(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeCameraDetail, selectedCamera, selectedCameraIndex]);

  return (
    <div className="live-monitor-panel p-5 sm:p-8 xl:p-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          eyebrow="live monitor"
          title="ดูภาพสดและ Timeline"
          description="เลือกรูปแบบการดูด้านล่าง แล้ว Timeline จะเปิดย้อนหลังตามรูปแบบเดียวกัน"
          icon={Radio}
        />
        <span className="inline-flex h-fit items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1.5 text-xs font-bold text-rose-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />
          LIVE STREAM
        </span>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(320px,1fr)_auto_auto_auto] lg:items-end">
        <InputField
          label="รูปแบบการดู"
          type="select"
          value={liveChannel}
          onChange={(value) => {
            setLiveChannel(value);
            stopLive();
          }}
          options={[
            { value: "all", label: `ดูทุกกล้อง (${channels.length} ช่อง)` },
            ...channels.map((channel) => ({
              value: String(channel),
              label: `กล้อง ${String(channel).padStart(2, "0")}`,
            })),
          ]}
          className="min-w-0"
        />
        <button
          onClick={restartLiveWall}
          disabled={isStartingLive}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 text-sm font-black text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60"
        >
          {isStartingLive ? <LoaderCircle className="animate-spin" size={16} /> : viewingAll ? <LayoutGrid size={16} /> : <Play size={16} />}
          {isStartingLive ? "กำลังเริ่มสตรีม..." : viewingAll ? "เปิดภาพสดทุกกล้อง" : "เปิดภาพสดช่องนี้"}
        </button>
        <button
          onClick={captureLive}
          disabled={captureAction}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-400/15 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {captureAction ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <Camera size={16} />
          )}
          {captureAction ? "กำลังเริ่มบันทึก..." : "บันทึกภาพกล้องวงจรปิด"}
        </button>
        <button
          onClick={stopLiveWall}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.1]"
        >
          <Square size={14} />
          หยุด
        </button>
      </div>
      {wallMode && !selectedCamera ? (
        <FullscreenWallPortal active={isFullscreen}>
        <div
          ref={wallRef}
          data-testid="live-wall"
          className={isFullscreen
            ? "fixed inset-0 z-[100] flex h-[100dvh] w-[100dvw] flex-col overflow-hidden border-0 bg-black p-0 shadow-none"
            : "mt-5 border border-rose-300/15 bg-black/30 p-3 shadow-2xl sm:p-4 rounded-3xl"}
        >
          <div
            className={isFullscreen
              ? "relative z-20 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 bg-slate-950 px-4 sm:px-5"
              : "mb-3 flex flex-wrap items-center justify-between gap-2 px-1"}
          >
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
              {wallLabel}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-data text-xs text-slate-500">
                {channels.length} ช่อง ·{" "}
                {wallMode === "playback"
                  ? isPlaybackLoading
                    ? `กำลังดึงภาพ ${settledGroupCount}/${playbackTileCount} ช่อง`
                    : playbackHasNoMatches
                      ? "ไม่พบภาพย้อนหลัง"
                      : `${thaiDateLabel(playbackTarget?.date || timelineDate)} ${playbackTarget?.time || timeLabel(timelineMinute)}`
                  : allStreamsReady
                    ? "วิดีโอสดต่อเนื่อง"
                    : `กำลังเชื่อมต่อ ${readyGroups.length}/${wallGroups.length} ชุด`}
              </span>
              <button
                onClick={toggleFullscreen}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-bold text-slate-200 transition hover:bg-white/[0.12]"
              >
                {isFullscreen ? (
                  <Minimize2 size={15} />
                ) : (
                  <Maximize2 size={15} />
                )}
                {isFullscreen ? "ออกเต็มจอ" : "เต็มหน้าจอ"}
              </button>
            </div>
          </div>
          <div
            className={`monitor-stage relative overflow-hidden bg-slate-950 ${isFullscreen ? "min-h-0 flex-1 rounded-none border-0 shadow-none" : "rounded-2xl border border-white/10"}`}
          >
            <div
              className={
                wallMode === "playback"
                  ? isFullscreen
                    ? "grid h-full grid-cols-4 grid-rows-5 gap-px bg-white/10"
                    : "grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3 lg:grid-cols-6"
                  : isFullscreen
                  ? "grid h-full bg-white/10"
                  : "grid gap-px bg-white/10 md:grid-cols-2"
              }
              style={
                wallMode !== "playback" && isFullscreen
                  ? {
                      gridTemplateRows: `repeat(${wallGroups.length}, minmax(0, 1fr))`,
                    }
                  : undefined
              }
            >
              {wallMode === "playback" ? (
                channels.map((channel) => {
                  const tileReady = readyGroups.includes(channel);
                  const tileFailed = failedGroups.includes(channel);
                  return (
                  <div
                    key={channel}
                    className={`relative bg-slate-950 ${isFullscreen ? "min-h-0" : "aspect-video"}`}
                  >
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
                        {tileFailed ? (
                          <CircleAlert size={18} className="text-amber-300" />
                        ) : (
                          <LoaderCircle className="animate-spin" size={18} />
                        )}
                        <span className="text-[10px] font-bold">
                          {tileFailed ? "ไม่พบภาพย้อนหลัง" : "กำลังดึงภาพ"}
                        </span>
                      </div>
                      {!tileFailed && (
                        <img
                          key={`playback-${wallRequestToken}-${channel}`}
                          src={playbackFrameUrl(channel)}
                          onLoad={() =>
                            setReadyGroups((current) =>
                              current.includes(channel) ? current : [...current, channel],
                            )
                          }
                          onError={() =>
                            setFailedGroups((current) =>
                              current.includes(channel) ? current : [...current, channel],
                            )
                          }
                          alt={`ภาพย้อนหลังกล้อง ${String(channel).padStart(2, "0")}`}
                          className={`absolute inset-0 z-20 h-full w-full object-cover transition-opacity duration-300 ${tileReady ? "opacity-100" : "opacity-0"}`}
                        />
                      )}
                      <div className="pointer-events-none absolute inset-0 z-30 border border-white/10 p-1.5 sm:p-2">
                        <span className="rounded-md bg-slate-950/80 px-1.5 py-1 text-[9px] font-black text-white shadow-lg sm:text-[10px]">
                          กล้อง {String(channel).padStart(2, "0")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCameraDetail(channel)}
                        aria-label={`ดูรายละเอียดภาพย้อนหลัง กล้อง ${String(channel).padStart(2, "0")}`}
                        className="absolute inset-0 z-40 cursor-zoom-in rounded-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-inset hover:bg-cyan-300/10"
                      />
                    </div>
                  );
                })
              ) : (
              wallGroups.map((group, groupIndex) => {
                const groupReady = readyGroups.includes(groupIndex);
                const groupFailed = failedGroups.includes(groupIndex);
                return (
                  <div
                    key={group.join("-")}
                    className={`relative ${isFullscreen ? "min-h-0" : ""}`}
                  >
                    <div
                      className={`grid ${isFullscreen ? "h-full grid-cols-4" : "grid-cols-3"}`}
                    >
                      {group.map((channel) => (
                        <div
                          key={channel}
                          className={`relative flex items-center justify-center bg-slate-950 ${isFullscreen ? "min-h-0" : "aspect-video"}`}
                        >
                          <div className="flex flex-col items-center gap-2 text-slate-600">
                            {groupFailed ? (
                              <CircleAlert
                                size={18}
                                className="text-amber-300"
                              />
                            ) : (
                              <LoaderCircle
                                className="animate-spin"
                                size={18}
                              />
                            )}
                            <span className="text-[10px] font-bold">
                              {groupFailed
                                ? "เชื่อมต่อวิดีโอไม่ได้"
                                : "กำลังเชื่อมต่อ"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {!groupFailed && (
                      <img
                        key={`${wallMode}-${wallRequestToken}-${groupIndex}`}
                        src={wallStreamUrl(group)}
                        onLoad={(event) => {
                          cacheWallPreviews(event.currentTarget, group);
                          setReadyGroups((current) =>
                            current.includes(groupIndex)
                              ? current
                              : [...current, groupIndex],
                          );
                        }}
                        onError={() =>
                          setFailedGroups((current) =>
                            current.includes(groupIndex)
                              ? current
                              : [...current, groupIndex],
                          )
                        }
                        alt={`วิดีโอ${wallMode === "playback" ? "ย้อนหลัง" : "สด"}กล้อง ${group.join(", ")}`}
                        className={`absolute inset-0 z-20 h-full w-full object-cover transition-opacity duration-300 ${groupReady ? "opacity-100" : "opacity-0"}`}
                      />
                    )}
                    <div
                      className={`pointer-events-none absolute inset-0 z-30 grid ${isFullscreen ? "grid-cols-4" : "grid-cols-3"}`}
                    >
                      {group.map((channel) => (
                        <div
                          key={channel}
                          className="border border-white/10 p-1.5 sm:p-2"
                        >
                          <span className="rounded-md bg-slate-950/80 px-1.5 py-1 text-[9px] font-black text-white shadow-lg sm:text-[10px]">
                            กล้อง {String(channel).padStart(2, "0")}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      className={`absolute inset-0 z-40 grid ${isFullscreen ? "grid-cols-4" : "grid-cols-3"}`}
                    >
                      {group.map((channel) => (
                        <button
                          key={`detail-${channel}`}
                          type="button"
                          onClick={() => openCameraDetail(channel)}
                          aria-label={`ดูรายละเอียดภาพสด กล้อง ${String(channel).padStart(2, "0")}`}
                          className="cursor-zoom-in border border-transparent transition hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-inset"
                        />
                      ))}
                    </div>
                  </div>
                );
              })
              )}
            </div>
            {isPlaybackLoading && (
              <div
                className="pointer-events-none absolute inset-x-3 top-3 z-40 flex justify-center p-2 text-center"
                role="status"
                aria-live="polite"
              >
                <div className="max-w-md rounded-2xl border border-indigo-200/20 bg-slate-900/92 px-5 py-3 shadow-2xl backdrop-blur-md">
                  <div className="flex items-center justify-center gap-3 text-indigo-100">
                    <LoaderCircle
                      className="animate-spin text-cyan-300"
                      size={24}
                    />
                    <span className="text-base font-black">
                      กำลังค้นหาภาพย้อนหลังจาก NVR
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    {thaiDateLabel(playbackTarget?.date || timelineDate)} เวลา{" "}
                    {playbackTarget?.time || timeLabel(timelineMinute)}
                  </p>
                  <p className="mt-1 font-data text-xs text-cyan-200">
                    โหลดแล้ว {settledGroupCount}/{playbackTileCount} ช่องกล้อง
                  </p>
                </div>
              </div>
            )}
            {playbackHasNoMatches && (
              <div className="absolute inset-x-4 bottom-4 z-40 rounded-2xl border border-amber-300/20 bg-slate-950/92 px-4 py-3 text-center text-sm font-bold text-amber-100 shadow-xl">
                ไม่พบภาพย้อนหลังจาก NVR ในเวลาที่เลือก ลองเลือกช่วงเวลาอื่น
              </div>
            )}
            {isSwitchingFullscreen && (
              <div
                className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/88"
                role="status"
                aria-live="polite"
              >
                <div className="rounded-2xl border border-cyan-300/20 bg-slate-900 px-5 py-4 text-center shadow-2xl">
                  <LoaderCircle className="mx-auto animate-spin text-cyan-300" size={24} />
                  <p className="mt-2 text-sm font-black text-white">กำลังสลับรูปแบบภาพรวม</p>
                  <p className="mt-1 text-xs text-slate-400">กำลังเริ่มสตรีมใหม่สำหรับเต็มหน้าจอ</p>
                </div>
              </div>
            )}
          </div>
          {!isFullscreen && (
            <p className="mt-3 text-center text-[11px] text-slate-500">
              {allStreamsReady
                ? wallMode === "playback"
                  ? "แสดงภาพย้อนหลังตามเวลาที่เลือกจาก NVR"
                  : "กำลังเล่นวิดีโอรวมจาก NVR ตามเวลาจริง"
                : failedGroups.length
                  ? wallMode === "playback"
                    ? "บางกล้องไม่มีภาพในเวลาที่เลือก ส่วนที่พบจะแสดงทันที"
                    : "บางชุดเชื่อมต่อวิดีโอไม่ได้ โปรดลองเปิดใหม่อีกครั้ง"
                  : wallMode === "playback"
                    ? "กำลังดึงภาพย้อนหลังทีละกล้อง เพื่อไม่ให้กล้องที่ช้าทำให้ทั้งหน้าค้าง"
                    : "กำลังเริ่มวิดีโอรวมจาก NVR ชุดละ 3 กล้อง"}
            </p>
          )}
        </div>
        </FullscreenWallPortal>
      ) : (
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
      )}
      <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-slate-900 via-slate-900/95 to-cyan-950/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
              <h3 className="text-lg font-black text-white">Timeline กล้อง</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              หมุดแดงคือเวลาปัจจุบันแบบ LIVE และเลื่อนตามนาฬิกาจริง
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isLiveDate && (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1.5 text-xs font-black text-rose-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />
                LIVE {timeLabel(liveNowMinute)}
              </span>
            )}
            <span className="rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-bold text-indigo-200">
              {thaiDateLabel(timelineDate)} · {timeLabel(timelineMinute)}
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[210px_1fr_190px] lg:items-end">
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
            <div className="relative">
              <input
                aria-label="เลือกเวลาใน NVR"
                type="range"
                min="0"
                max="1439"
                value={timelineMinute}
                onChange={(event) =>
                  setTimelineMinute(Number(event.target.value))
                }
                style={{
                  "--timeline-progress": `${isLiveViewing ? 100 : progress}%`,
                }}
                className={`timeline-range ${isLiveViewing ? "timeline-range-live" : ""}`}
              />
              {isLiveDate && (
                <span
                  aria-hidden="true"
                  title={`LIVE ${timeLabel(liveNowMinute)}`}
                  className="pointer-events-none absolute top-1/2 z-10 h-6 w-1 -translate-y-1/2 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,.95)]"
                  style={{ left: `calc(${liveProgress}% - 2px)` }}
                />
              )}
            </div>
            <div className="mt-2 grid grid-cols-5 font-data text-[10px] font-bold text-slate-500">
              <span>00:00</span>
              <span className="text-center">06:00</span>
              <span className="text-center">12:00</span>
              <span className="text-center">18:00</span>
              <span className="text-right">24:00</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={startPlayback}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-400"
            >
              {viewingAll ? <LayoutGrid size={17} /> : <Eye size={17} />}
              {viewingAll ? "ดูย้อนหลังทุกกล้อง" : "ดูย้อนหลังช่องนี้"}
            </button>
            <button
              onClick={goLiveNow}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 text-xs font-black text-rose-100 transition hover:border-rose-300/45 hover:bg-rose-400/20"
            >
              <Radio size={16} />
              กลับ LIVE
            </button>
          </div>
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
      {selectedCamera && (
        <CameraDetailModal
          channelLabel={selectedCameraLabel}
          source={detailImageUrl}
          previewSource={detailPreview}
          isPlayback={wallMode === "playback"}
          timestamp={`${thaiDateLabel(playbackTarget?.date || timelineDate)} · ${playbackTarget?.time || timeLabel(timelineMinute)}`}
          onClose={closeCameraDetail}
          onPrevious={() => moveCameraDetail(-1)}
          onNext={() => moveCameraDetail(1)}
          onRefresh={() => setDetailToken(Date.now())}
        />
      )}
    </div>
  );
}

function CameraDetailModal({
  channelLabel,
  source,
  previewSource,
  isPlayback,
  timestamp,
  onClose,
  onPrevious,
  onNext,
  onRefresh,
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-dvh w-screen items-center justify-center overflow-hidden bg-slate-950/90 p-0 backdrop-blur-md"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-detail-title"
        className="flex h-dvh w-screen flex-col overflow-hidden bg-slate-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Camera size={17} className="text-cyan-300" />
              <h3 id="camera-detail-title">{channelLabel}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isPlayback ? "bg-indigo-400/15 text-indigo-200" : "bg-rose-400/15 text-rose-200"}`}>
                {isPlayback ? "ภาพย้อนหลัง" : "LIVE"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {isPlayback ? timestamp : "วิดีโอสดความละเอียดเต็ม · กดรีเฟรชเพื่อเริ่มสตรีมใหม่"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isPlayback && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <RefreshCw size={15} />
                รีเฟรชภาพ
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="ปิดรายละเอียดกล้อง"
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {isPlayback ? (
            <CameraDetailImage
              key={source}
              source={source}
              previewSource={previewSource}
              channelLabel={channelLabel}
              isPlayback
            />
          ) : (
            <LiveCameraDetailImage
              key={source}
              source={source}
              previewSource={previewSource}
              channelLabel={channelLabel}
            />
          )}
          <button
            type="button"
            onClick={onPrevious}
            aria-label="ดูกล้องก่อนหน้า"
            className="absolute left-3 inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-slate-950/75 text-white shadow-xl backdrop-blur transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:left-5"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="ดูกล้องถัดไป"
            className="absolute right-3 inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-slate-950/75 text-white shadow-xl backdrop-blur transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:right-5"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        <footer className="border-t border-white/10 bg-slate-900/90 px-4 py-3 text-center text-xs text-slate-400 sm:px-6">
          กด Esc เพื่อปิด · กด ← / → เพื่อเปลี่ยนกล้อง
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function LiveCameraDetailImage({ source, previewSource, channelLabel }) {
  const [status, setStatus] = useState("loading");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setStatus("loading");
    setFailed(false);
  }, [source]);

  return (
    <>
      {previewSource && (
        <img
          src={previewSource}
          alt={`ภาพตัวอย่าง ${channelLabel}`}
          className={`pointer-events-none absolute inset-0 z-[1] h-full w-full object-contain transition-opacity duration-200 ${status === "ready" ? "opacity-0" : "opacity-90"}`}
        />
      )}
      {source && (
        <img
          src={source}
          alt={`วิดีโอสด ${channelLabel}`}
          onLoad={() => setStatus("ready")}
          onError={() => {
            setFailed(true);
            setStatus("failed");
          }}
          className={`relative z-[2] h-full w-full object-contain transition-opacity duration-200 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/20 text-slate-300">
          <LoaderCircle className="animate-spin text-cyan-300" size={28} />
          <span className="text-sm font-bold">
            {source ? `กำลังเชื่อมต่อวิดีโอสด ${channelLabel}` : "กำลังเตรียมวิดีโอสด"}
          </span>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center text-amber-100">
          <CircleAlert className="text-amber-300" size={28} />
          <p className="font-bold">เชื่อมต่อวิดีโอสด {channelLabel} ไม่สำเร็จ</p>
          <p className="text-sm text-slate-400">ภาพตัวอย่างล่าสุดจะแสดงอยู่ด้านหลัง · ลองกดรีเฟรชภาพ</p>
        </div>
      )}
    </>
  );
}

function CameraDetailImage({ source, previewSource, channelLabel, isPlayback }) {
  const [status, setStatus] = useState("loading");
  const [imageUrl, setImageUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const failed = status === "failed";

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    let timedOut = false;
    setStatus("loading");
    setImageUrl("");
    setErrorMessage("");
    if (!source) return () => controller.abort();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    fetch(source, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) throw new Error("รูปแบบภาพไม่ถูกต้อง");
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setErrorMessage("ไม่สามารถเชื่อมต่อภาพจากกล้องได้");
          setStatus("failed");
        }
        if (timedOut) {
          setErrorMessage("ภาพใช้เวลาโหลดนานกว่าปกติ");
          setStatus("failed");
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return (
    <>
      {previewSource && (
        <img
          src={previewSource}
          alt={`ภาพตัวอย่าง ${channelLabel}`}
          className={`pointer-events-none absolute inset-0 z-[1] h-full w-full object-contain transition-opacity duration-200 ${status === "ready" ? "opacity-0" : "opacity-90"}`}
        />
      )}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/20 text-slate-300">
          <LoaderCircle className="animate-spin text-cyan-300" size={28} />
          <span className="text-sm font-bold">
            {previewSource ? "กำลังดึงภาพความละเอียดเต็ม" : `กำลังเชื่อมต่อภาพ ${channelLabel}`}
          </span>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center text-amber-100">
          <CircleAlert className="text-amber-300" size={28} />
          <p className="font-bold">ดึงภาพ {channelLabel} ไม่สำเร็จ</p>
          <p className="text-sm text-slate-400">
            {previewSource
              ? "กำลังแสดงภาพตัวอย่างล่าสุดจากภาพรวม · กดรีเฟรชเพื่อลองภาพความละเอียดเต็มอีกครั้ง"
              : errorMessage || "โปรดลองเปลี่ยนกล้อง หรือกดรีเฟรชภาพอีกครั้ง"}
          </p>
        </div>
      )}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={`${isPlayback ? "ภาพย้อนหลัง" : "ภาพสด"} ${channelLabel}`}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("failed")}
          className={`relative z-[2] max-h-[calc(100dvh-124px)] h-full w-full object-contain transition-opacity duration-200 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
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
                        group.rounds.find((batch) => batch.export_url)
                          .export_url
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
