export const getContrastColor = (hex: string) => {
  if (!hex) return "#ffffff";
  const cleaned = hex.replace("#", "").trim();
  const normalized = cleaned.length === 3 ? cleaned.split("").map((x) => `${x}${x}`).join("") : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#ffffff";
  const r = parseInt(normalized.substr(0, 2), 16);
  const g = parseInt(normalized.substr(2, 2), 16);
  const b = parseInt(normalized.substr(4, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
};
