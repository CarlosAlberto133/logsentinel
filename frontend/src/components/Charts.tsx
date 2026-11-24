"use client";

import { FileMetric, HourlyMetric } from "@/lib/api";

export function SparklineArea({
  values,
  color = "#38bdf8",
}: {
  values: number[];
  color?: string;
}) {
  const data = values.length > 1 ? values : [0, 2, 1, 4, 3, 5, 4];
  const max = Math.max(...data, 1);
  const w = 240;
  const h = 64;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 10) - 4;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" />
    </svg>
  );
}

export function ExceptionsAreaChart({ data }: { data: HourlyMetric[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 600;
  const h = 150;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : 0;
    const y = h - (d.count / max) * (h - 20) - 8;
    return `${x},${y}`;
  });

  const linePath = points.length ? `M ${points.join(" L ")}` : "";
  const areaPath = points.length ? `${linePath} L ${w},${h} L 0,${h} Z` : "";

  return (
    <div className="flex flex-col">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="roseArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1="0"
            y1={h * pct}
            x2={w}
            y2={h * pct}
            stroke="#27272a"
            strokeDasharray="3 3"
          />
        ))}
        {areaPath && <path d={areaPath} fill="url(#roseArea)" />}
        {linePath && <path d={linePath} fill="none" stroke="#fb7185" strokeWidth="2" />}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-zinc-500">
        <span>{data[0]?.hour || "00:00"}</span>
        <span>{data[Math.floor(data.length / 2)]?.hour || "12:00"}</span>
        <span>{data[data.length - 1]?.hour || "23:00"}</span>
      </div>
    </div>
  );
}

export function TopFilesChart({ files }: { files: FileMetric[] }) {
  const max = Math.max(...files.map((f) => f.count), 1);
  const colors = ["bg-sky-400", "bg-indigo-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400", "bg-violet-400"];

  if (files.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
        Aguardando stack traces com caminhos de arquivo...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((item, idx) => {
        const pct = Math.max(Math.round((item.count / max) * 100), 6);
        return (
          <div key={item.file} className="space-y-1">
            <div className="flex justify-between font-mono text-xs">
              <span className="truncate text-zinc-300">{item.file}</span>
              <span className="text-zinc-400">{item.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/80">
              <div
                style={{ width: `${pct}%` }}
                className={`h-full rounded-full ${colors[idx % colors.length]}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}