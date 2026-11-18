import { AlertTriangle, ArrowDownRight, ArrowUpRight, Inbox, Info } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "../lib/api";
import { fmtDate, fmtNumber, fmtPercent } from "../lib/format";
import type { Kpi } from "../lib/types";

export function Panel({ title, icon, actions, children, className = "", glow, subtitle }: {
  title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; glow?: boolean;
  subtitle?: ReactNode;
}) {
  return (
    <section className={`panel ${glow ? "panel-glow" : ""} flex min-w-0 flex-col p-4 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              {icon && <span className="text-cyan">{icon}</span>}
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES = {
  blue: "bg-blue/15 text-cyan border-blue/40",
  teal: "bg-teal/15 text-teal border-teal/40",
  violet: "bg-violet/15 text-violet border-violet/40",
  warn: "bg-warn/15 text-warn border-warn/40",
  danger: "bg-danger/15 text-danger border-danger/40",
  muted: "bg-white/5 text-muted border-line",
};

export function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span title="Datos sintéticos de demostración: no representan estudiantes reales">
      <Badge tone="warn">DEMO</Badge>
    </span>
  );
}

export function KpiCard({ kpi, accent = "text-cyan" }: { kpi: Kpi; accent?: string }) {
  const value = kpi.unit === "%" ? fmtPercent(kpi.value) : `${fmtNumber(kpi.value)}${kpi.unit === "h" ? " h" : ""}`;
  const up = (kpi.change ?? 0) >= 0;
  return (
    <div className="panel min-w-0 p-3" title={`Fuente: ${kpi.source} · actualizado ${fmtDate(kpi.as_of)}`}>
      <p className="truncate text-xs text-muted">{kpi.label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {kpi.change != null ? (
        <p className={`mt-1 flex items-center gap-1 text-xs ${up ? "text-teal" : "text-danger"}`}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {fmtPercent(Math.abs(kpi.change))} <span className="text-muted">vs periodo anterior</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">sin periodo comparable</p>
      )}
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} aria-label="Cargando" />;
}

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted">
      {icon ?? <Inbox size={22} />}
      {message}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 p-4 text-center text-sm">
      <AlertTriangle className="text-danger" size={20} />
      <p>{e?.message ?? "No se pudo cargar la información"}</p>
      {e?.correlationId && <p className="text-xs text-muted">correlation_id: {e.correlationId}</p>}
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function QueryState<T>({ q, children, empty, skeleton }: {
  q: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown };
  children: (data: T) => ReactNode;
  empty?: (data: T) => boolean;
  skeleton?: string;
}) {
  if (q.isLoading) return <Skeleton className={skeleton} />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data === undefined) return null;
  if (empty?.(q.data)) return <EmptyState message="Sin datos para los filtros seleccionados" />;
  return <>{children(q.data)}</>;
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-line bg-blue/5 p-2.5 text-xs text-muted">
      <Info size={14} className="mt-0.5 shrink-0 text-cyan" />
      <span>{children}</span>
    </p>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="panel w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-muted hover:text-ink" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}
