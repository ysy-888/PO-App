/**
 * Style Master helpers — sizeCat expansion and entity keys.
 */

export const SIZE_CAT_LABELS = {
  "XS-XL": ["XS", "S", "M", "L", "XL"],
  "XXS-XXL": ["XXS", "XS", "S", "M", "L", "XL", "XXL"],
  "XS-L": ["XS", "S", "M", "L"],
  PL: ["1X", "2X", "3X"],
  PT: ["XS PT", "S PT", "M PT", "L PT", "XL PT"],
};

export function expandSizeCatToLabels(sizeCat) {
  const key = String(sizeCat ?? "").trim();
  if (!key) return [];
  const known = SIZE_CAT_LABELS[key];
  if (known) return [...known];
  return [];
}

export function applySizeLabelsToRow(row, labels) {
  for (let i = 0; i < 15; i++) {
    row[`Size ${i + 1}`] = labels[i] ?? "";
  }
}

export function buildStyleRowData(raw) {
  const styleNum = String(raw?.["Style #"] ?? "").trim();
  const color = String(raw?.["Color"] ?? "").trim();
  const sizeCat = String(raw?.["Size Cat"] ?? "").trim();
  const out = { ...raw, "Style #": styleNum, Color: color };
  if (sizeCat) {
    out["Size Cat"] = sizeCat;
    applySizeLabelsToRow(out, expandSizeCatToLabels(sizeCat));
  }
  return out;
}

export function styleEntityId(styleNum, color) {
  const style = String(styleNum ?? "").trim();
  const shade = String(color ?? "").trim();
  if (!style || !shade) return "";
  return `${style}|${shade}`;
}

export function styleRowValuesEqual(existing, incoming) {
  const fields = [
    "Style #", "Color", "Size Cat", "Style Category", "Description", "FOB Cost", "Division",
    ...Array.from({ length: 15 }, (_, i) => `Size ${i + 1}`),
  ];
  return fields.every(field =>
    String(existing?.[field] ?? "").trim() === String(incoming?.[field] ?? "").trim()
  );
}
