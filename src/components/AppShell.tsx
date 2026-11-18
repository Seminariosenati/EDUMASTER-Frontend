import { useQuery } from "@tanstack/react-query";
import {
  Award, BarChart3, Bell, BookOpen, BrainCircuit, ClipboardList, GraduationCap, LayoutDashboard, LogOut, Map, Menu,
  ScrollText, Sparkles, Users, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { STAFF, useAuth } from "../lib/auth";
import { fmtPercent, ROLE_LABEL, timeAgo } from "../lib/format";
import { RealtimeProvider, useRealtime } from "../lib/realtime";
import type { Role, Summary } from "../lib/types";
import { DemoBadge } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: "/", label: "Resumen", icon: <LayoutDashboard size={17} /> },
  { to: "/rutas", label: "Planes de aprendizaje", icon: <Map size={17} /> },
  { to: "/cursos", label: "Cursos", icon: <BookOpen size={17} /> },
  { to: "/analisis", label: "Análisis", icon: <BarChart3 size={17} />, roles: [...STAFF, "docente", "auditor"] },
  { to: "/ia", label: "IA · Red neuronal", icon: <BrainCircuit size={17} /> },
  { to: "/recomendaciones", label: "Recomendaciones", icon: <Sparkles size={17} /> },
  { to: "/certificados", label: "Certificados", icon: <Award size={17} /> },
  { to: "/estudiantes", label: "Estudiantes", icon: <GraduationCap size={17} />, roles: [...STAFF, "docente"] },
  { to: "/usuarios", label: "Usuarios", icon: <Users size={17} />, roles: ["admin", "superadmin"] },
  { to: "/auditoria", label: "Auditoría", icon: <ScrollText size={17} />, roles: ["auditor", "admin", "superadmin"] },
];

export function AppShell() {
  const { me } = useAuth();
  return (
    <RealtimeProvider enabled={!!me}>
      <Shell />
    </RealtimeProvider>
  );
}

function Shell() {
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const summary = useQuery({ queryKey: ["summary", 30], queryFn: () => api<Summary>("/dashboard/summary") });
  const items = NAV.filter((n) => !n.roles || (me && n.roles.includes(me.role)));

  return (
    <div className="flex min-h-full">
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-4 border-r border-line bg-bg p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="text-cyan" />
            <span className="text-lg font-bold">
              EduMaster<span className="text-cyan">.ai</span>
            </span>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isActive ? "bg-blue text-white shadow-[0_0_18px_-4px_#087FE5]" : "text-muted hover:bg-white/5 hover:text-ink"}`
              }
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <ModelCard summary={summary.data} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <p className="hidden text-sm font-semibold tracking-wide text-muted sm:block">
            Aprende <span className="text-cyan">•</span> Practica <span className="text-cyan">•</span> Destaca
          </p>
          <div className="ml-auto flex items-center gap-3">
            {me?.organization_is_demo && <DemoBadge />}
            <ConnectionPill />
            <Notifications />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{me?.full_name}</p>
              <p className="text-[11px] text-muted">
                {ROLE_LABEL[me?.role ?? ""]} · {me?.organization_name}
              </p>
            </div>
            <button className="btn btn-ghost px-2" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ModelCard({ summary }: { summary?: Summary }) {
  const m = summary?.model;
  return (
    <div className="panel mt-auto p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <BrainCircuit size={14} className="text-violet" /> Modelo en producción
      </p>
      {m ? (
        <>
          <p className="mt-1 text-2xl font-bold text-cyan">{fmtPercent(m.completion_roc_auc)}</p>
          <p className="text-[11px] text-muted">ROC-AUC finalización · v{m.version}</p>
          <p className="mt-1 text-[11px] text-muted">
            {m.dataset_demo ? "Medido sobre datos DEMO" : "Datos institucionales"} ·{" "}
            {m.supera_baseline ? "supera baseline" : "no supera baseline"}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted">Aún no hay un modelo publicado.</p>
      )}
    </div>
  );
}

function ConnectionPill() {
  const { status, lastEventAt } = useRealtime();
  const tone = status === "conectado" ? "bg-teal" : status === "sin_conexion" ? "bg-danger" : "bg-warn";
  const label = status === "conectado" ? "En vivo" : status === "sin_conexion" ? "Sin conexión" : "Reconectando";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" title={lastEventAt ? `Último evento ${timeAgo(lastEventAt)}` : "Sin eventos aún"}>
      <span className={`h-2 w-2 rounded-full ${tone} ${status === "conectado" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ id: string; title: string; body: string; read: boolean; created_at: string }[]>("/notifications"),
  });
  const unread = q.data?.filter((n) => !n.read).length ?? 0;
  return (
    <div className="relative">
      <button className="btn btn-ghost relative px-2" onClick={() => setOpen((o) => !o)} aria-label="Notificaciones">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-violet px-1.5 text-[10px] font-bold">{unread}</span>
        )}
      </button>
      {open && (
        <div className="panel absolute right-0 top-11 z-50 w-80 p-2">
          {(q.data ?? []).length === 0 && <p className="p-3 text-sm text-muted">Sin notificaciones</p>}
          {(q.data ?? []).slice(0, 8).map((n) => (
            <div key={n.id} className="rounded-lg p-2 hover:bg-white/5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ClipboardList size={13} className="text-cyan" />
                {n.title}
              </p>
              <p className="text-xs text-muted">{n.body}</p>
              <p className="text-[10px] text-muted">{timeAgo(n.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
