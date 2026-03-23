import * as crypto from "node:crypto";

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartResult {
  widget_id: string;
  html: string;
  title: string;
}

const DEFAULT_COLORS = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
  "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac",
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function executePieChart({
  title,
  data,
}: {
  title: string;
  data: ChartDataPoint[];
}): Promise<ChartResult> {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = 200;
  const cy = 200;
  const r = 150;

  let currentAngle = -Math.PI / 2;
  const slices: string[] = [];
  const legends: string[] = [];

  data.forEach((d, i) => {
    const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(currentAngle);
    const y1 = cy + r * Math.sin(currentAngle);
    const x2 = cx + r * Math.cos(currentAngle + sliceAngle);
    const y2 = cy + r * Math.sin(currentAngle + sliceAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const pct = ((d.value / total) * 100).toFixed(1);

    slices.push(
      `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}">
        <title>${escapeHtml(d.label)}: ${d.value} (${pct}%)</title>
      </path>`,
    );

    legends.push(
      `<div style="display:flex;align-items:center;gap:6px;margin:4px 0">
        <div style="width:14px;height:14px;background:${color};border-radius:2px;flex-shrink:0"></div>
        <span>${escapeHtml(d.label)} — ${d.value} (${pct}%)</span>
      </div>`,
    );

    currentAngle += sliceAngle;
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #fff; color: #333; }
  h2 { margin: 0 0 16px; font-size: 18px; }
  .chart-container { display: flex; align-items: center; gap: 32px; flex-wrap: wrap; }
  .legend { font-size: 13px; }
</style></head><body>
  <h2>${escapeHtml(title)}</h2>
  <div class="chart-container">
    <svg width="400" height="400" viewBox="0 0 400 400">${slices.join("")}</svg>
    <div class="legend">${legends.join("")}</div>
  </div>
</body></html>`;

  return {
    widget_id: crypto.randomUUID(),
    html,
    title,
  };
}

export async function executeBarChart({
  title,
  data,
}: {
  title: string;
  data: ChartDataPoint[];
}): Promise<ChartResult> {
  const maxValue = Math.max(...data.map((d) => d.value));
  const barHeight = 32;
  const gap = 8;
  const labelWidth = 120;
  const chartWidth = 500;
  const barAreaWidth = chartWidth - labelWidth - 60;
  const svgHeight = data.length * (barHeight + gap) + 20;

  const bars: string[] = [];

  data.forEach((d, i) => {
    const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    const y = i * (barHeight + gap) + 10;
    const width = maxValue > 0 ? (d.value / maxValue) * barAreaWidth : 0;

    bars.push(
      `<text x="${labelWidth - 8}" y="${y + barHeight / 2 + 5}" text-anchor="end" font-size="13" fill="#333">${escapeHtml(d.label)}</text>
       <rect x="${labelWidth}" y="${y}" width="${width}" height="${barHeight}" rx="4" fill="${color}">
         <title>${escapeHtml(d.label)}: ${d.value}</title>
       </rect>
       <text x="${labelWidth + width + 6}" y="${y + barHeight / 2 + 5}" font-size="12" fill="#666">${d.value}</text>`,
    );
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #fff; color: #333; }
  h2 { margin: 0 0 16px; font-size: 18px; }
</style></head><body>
  <h2>${escapeHtml(title)}</h2>
  <svg width="${chartWidth}" height="${svgHeight}" viewBox="0 0 ${chartWidth} ${svgHeight}">${bars.join("")}</svg>
</body></html>`;

  return {
    widget_id: crypto.randomUUID(),
    html,
    title,
  };
}
