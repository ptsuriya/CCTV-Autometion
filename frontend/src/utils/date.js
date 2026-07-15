export function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function timeLabel(minutes) {
  const value = Math.max(0, Math.min(1439, Number(minutes) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

export function localTimeMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function thaiDateLabel(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return date || "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function thaiResultLabel(batch) {
  const time = String(batch.time || "").replace("-", ":");
  return `รอบเวรที่ ${thaiDateLabel(batch.date)} เวลา ${time || "-"}`;
}

export function groupBatches(batches) {
  const groups = new Map();
  batches.forEach((batch) => {
    const key = batch.job_id || `${batch.date}-${batch.time}`;
    if (!groups.has(key)) {
      groups.set(key, { jobId: key, rounds: [], mode: batch.mode });
    }
    groups.get(key).rounds.push(batch);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    rounds: group.rounds.sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
    ),
  }));
}
