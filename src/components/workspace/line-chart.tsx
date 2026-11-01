"use client";

const COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#f43f5e", "#06b6d4", "#84cc16", "#f97316"];

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const step0 = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}

/** Simple responsive SVG line chart: x from the first column, one line per numeric series. */
export function LineChart({
  xLabel,
  xs,
  series,
}: {
  xLabel: string;
  xs: (number | string)[];
  series: { name: string; values: (number | null)[] }[];
}) {
  const W = 760;
  const H = 300;
  const pad = { l: 52, r: 16, t: 14, b: 42 };
  const numericX = xs.every((v) => typeof v === "number");
  const xVals = xs.map((v, i) => (numericX ? (v as number) : i));
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (!xs.length || !all.length) return <p className="text-dash-muted-foreground text-sm">Add numeric values to see a chart.</p>;
  let yMin = Math.min(...all);
  let yMax = Math.max(...all);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals) === xMin ? xMin + 1 : Math.max(...xVals);
  const sx = (v: number) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const sy = (v: number) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yTicks = niceTicks(yMin, yMax);
  const xTickIdx = numericX
    ? niceTicks(xMin, xMax, 6)
    : Array.from({ length: Math.min(8, xs.length) }, (_, i) => Math.round((i * (xs.length - 1)) / Math.max(1, Math.min(8, xs.length) - 1)));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Data chart">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className="stroke-slate-400/25" />
            <text x={pad.l - 6} y={sy(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {Math.abs(t) >= 1000 ? t.toLocaleString() : t}
            </text>
          </g>
        ))}
        {xTickIdx.map((t) => {
          const xv = numericX ? t : t;
          const label = numericX ? String(t) : String(xs[t] ?? "");
          return (
            <text key={`x-${t}`} x={sx(xv)} y={H - pad.b + 16} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {label.length > 10 ? `${label.slice(0, 10)}…` : label}
            </text>
          );
        })}
        <text x={(W + pad.l) / 2} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
          {xLabel}
        </text>
        {series.map((s, si) => {
          const pts = s.values
            .map((v, i) => (v === null ? null : `${sx(xVals[i])},${sy(v)}`))
            .filter(Boolean)
            .join(" ");
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2} strokeLinejoin="round" />
              {s.values.length <= 60
                ? s.values.map((v, i) => (v === null ? null : <circle key={i} cx={sx(xVals[i])} cy={sy(v)} r={2.8} fill={COLORS[si % COLORS.length]} />))
                : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs">
        {series.map((s, si) => (
          <span key={s.name} className="text-dash-muted-foreground flex items-center gap-1.5">
            <span className="h-2 w-4 rounded" style={{ background: COLORS[si % COLORS.length] }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
