import {
  Area, AreaChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtNumber, fmtPercent } from "../lib/format";
import type { WeekPoint } from "../lib/types";

const AXIS = { stroke: "var(--muted)", fontSize: 11 };
const GRID = "var(--line)";
const TOOLTIP = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12, color: "var(--ink)" },
  labelStyle: { color: "var(--ink)" },
};

export function TrendChart({ data, height = 230 }: { data: WeekPoint[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, label: d.week_start.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis yAxisId="a" {...AXIS} />
        <YAxis yAxisId="b" orientation="right" {...AXIS} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="a" type="monotone" dataKey="active_students" name="Estudiantes activos" stroke="var(--cyan)" strokeWidth={2.2} dot={false} />
        <Line yAxisId="b" type="monotone" dataKey="hours" name="Horas" stroke="var(--violet)" strokeWidth={2} dot={false} />
        <Line yAxisId="b" type="monotone" dataKey="completions" name="Finalizaciones" stroke="var(--teal)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const SEGMENT_COLOR: Record<string, string> = {
  completado: "var(--cyan)", en_progreso: "var(--primary)", no_iniciado: "var(--muted)", inactivo: "var(--danger)",
};
const SEGMENT_LABEL: Record<string, string> = {
  completado: "Completados", en_progreso: "En progreso", no_iniciado: "No iniciados", inactivo: "Inactivos",
};

export function CompletionDonut({ segments, total }: { segments: { key: string; count: number; share: number }[]; total: number }) {
  const completed = segments.find((s) => s.key === "completado");
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={segments} dataKey="count" nameKey="key" innerRadius={52} outerRadius={70} paddingAngle={2} stroke="none">
              {segments.map((s) => <Cell key={s.key} fill={SEGMENT_COLOR[s.key]} />)}
            </Pie>
            <Tooltip {...TOOLTIP} formatter={(v: number, k: string) => [fmtNumber(v), SEGMENT_LABEL[k]]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{fmtPercent(completed?.share ?? 0)}</span>
          <span className="text-[11px] text-muted">completados</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEGMENT_COLOR[s.key] }} />
            <span className="text-muted">{SEGMENT_LABEL[s.key]}</span>
            <span className="ml-auto font-semibold tabular-nums">{fmtPercent(s.share)}</span>
          </li>
        ))}
        <li className="pt-1 text-xs text-muted">{fmtNumber(total)} matrículas</li>
      </ul>
    </div>
  );
}

export function LossChart({ history, height = 220 }: { history: { epoch: number; train_loss: number; val_loss: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={history} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="epoch" {...AXIS} />
        <YAxis {...AXIS} domain={["auto", "auto"]} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="train_loss" name="Loss entrenamiento" stroke="var(--cyan)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="val_loss" name="Loss validación" stroke="var(--violet)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ResourceChart({ points, height = 150 }: { points: { t: string; cpu: number; mem: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="t" hide />
        <YAxis {...AXIS} domain={[0, 100]} unit="%" />
        <Tooltip {...TOOLTIP} formatter={(v: number) => `${v.toFixed(1)}%`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="cpu" name="CPU" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.18} isAnimationActive={false} />
        <Area type="monotone" dataKey="mem" name="Memoria" stroke="var(--violet)" fill="var(--violet)" fillOpacity={0.18} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
