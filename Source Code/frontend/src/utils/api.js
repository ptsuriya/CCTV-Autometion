export async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "ทำรายการไม่สำเร็จ");
  }
  return data;
}

export function getErrorItems(error) {
  if (!error || typeof error !== "object") return [];
  const items = [];
  Object.entries(error).forEach(([round, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.entries(value).forEach(([camera, detail]) =>
        items.push({ round, camera, detail: String(detail) }),
      );
    } else {
      items.push({ round: "", camera: "", detail: String(value) });
    }
  });
  return items;
}
