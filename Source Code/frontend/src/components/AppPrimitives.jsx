export function BrandMark({ compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "min-w-0"}`}>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-indigo-200/20 bg-[#10152b] shadow-[0_0_28px_rgba(99,102,241,.25)] sm:h-14 sm:w-14">
        <img
          src="/night-night-cctv.png"
          alt="Night Night CCTV"
          width="56"
          height="56"
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

export function StatusPill({ job }) {
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

export function SectionHeading({ eyebrow, title, description, icon: Icon }) {
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

export function InputField({
  label,
  value,
  onChange,
  type = "time",
  helper,
  className = "",
  options = [],
}) {
  const controlClass =
    "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm font-bold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60";
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">
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
