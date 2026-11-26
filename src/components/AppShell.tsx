import { useQuery } from "@tanstack/react-query";
import {
  Award, BarChart3, Bell, BookOpen, Bot, BrainCircuit, ClipboardCheck, ClipboardList, MessageSquare, MessagesSquare, GraduationCap, LayoutDashboard, LogOut, Map, Menu,
  PanelLeftClose, PanelLeftOpen, ScrollText, Search, Settings, Sparkles, X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { STAFF, useAuth } from "../lib/auth";
import { ROLE_LABEL, timeAgo } from "../lib/format";
import { RealtimeProvider, useRealtime, useRealtimeEvent } from "../lib/realtime";
import { ThemeToggle } from "../lib/theme";
import type { Role } from "../lib/types";
import { DemoBadge } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
  badgeKey?: "messages";
}

const NAV: NavItem[] = [
  { to: "/", label: "Resumen", icon: <LayoutDashboard size={20} /> },
  { to: "/rutas", label: "Planes de aprendizaje", icon: <Map size={20} /> },
  { to: "/cursos", label: "Cursos", icon: <BookOpen size={20} /> },
  { to: "/evaluaciones", label: "Evaluaciones", icon: <ClipboardCheck size={20} />, roles: [...STAFF, "docente", "estudiante"] },
  { to: "/tutor", label: "IA Tutor", icon: <Bot size={20} />, roles: [...STAFF, "docente", "estudiante"] },
  { to: "/comunidad", label: "Comunidad", icon: <MessagesSquare size={20} />, roles: [...STAFF, "docente", "estudiante", "auditor"] },
  { to: "/mensajes", label: "Mensajes", icon: <MessageSquare size={20} />, badgeKey: "messages" },
  { to: "/analisis", label: "Análisis", icon: <BarChart3 size={20} />, roles: [...STAFF, "docente", "auditor"] },
  { to: "/ia", label: "IA · Red neuronal", icon: <BrainCircuit size={20} /> },
  { to: "/recomendaciones", label: "Recomendaciones", icon: <Sparkles size={20} /> },
  { to: "/certificados", label: "Certificados", icon: <Award size={20} /> },
  { to: "/estudiantes", label: "Estudiantes", icon: <GraduationCap size={20} />, roles: [...STAFF, "docente"] },
  { to: "/auditoria", label: "Auditoría", icon: <ScrollText size={20} />, roles: ["auditor", "admin", "superadmin"] },
];

const SETTINGS: NavItem = { to: "/usuarios", label: "Usuarios y configuración", icon: <Settings size={20} />, roles: ["admin", "superadmin"] };

export function AppShell() {
  const { me } = useAuth();
  return (
    <RealtimeProvider enabled={!!me}>
      <Shell />
    </RealtimeProvider>
  );
}

const RAIL_KEY = "edumaster.rail";

function readExpanded() {
  try {
    return localStorage.getItem(RAIL_KEY) === "expanded";
  } catch {
    return false;
  }
}

function RailLink({ item, onClick, expanded, badge = 0 }: { item: NavItem; onClick: () => void; expanded: boolean; badge?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onClick}
      title={item.label}
      aria-label={badge ? `${item.label}, ${badge} sin leer` : item.label}
      className={({ isActive }) =>
        `relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${expanded ? "lg:w-full" : "lg:w-11 lg:justify-center lg:px-0"} ${isActive ? "bg-blue text-white shadow-[0_0_18px_-4px_var(--primary)]" : "text-muted hover:bg-ink/5 hover:text-ink"}`
      }
    >
      {item.icon}
      <span className={expanded ? "truncate" : "lg:hidden"}>{item.label}</span>
      {badge > 0 && (
        <span className={`rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white ${expanded ? "ml-auto" : "lg:absolute lg:right-0.5 lg:top-0.5 ml-auto lg:ml-0"}`}>{badge > 99 ? "99+" : badge}</span>
      )}
    </NavLink>
  );
}

function Shell() {
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(readExpanded);
  const toggleRail = () => {
    setExpanded((e) => {
      try {
        localStorage.setItem(RAIL_KEY, e ? "collapsed" : "expanded");
      } catch {
        /* sin almacenamiento: vale solo para esta pestaña */
      }
      return !e;
    });
  };
  const [q, setQ] = useState("");
  const unread = useQuery({ queryKey: ["messages", "unread"], queryFn: () => api<{ unread: number }>("/messages/unread"), refetchInterval: 60_000 });
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.roles || (me && n.roles.includes(me.role)));
  const showSettings = me && SETTINGS.roles!.includes(me.role);
  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/cursos?q=${encodeURIComponent(q.trim())}`);
  };
  const initials = (me?.full_name ?? "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="flex min-h-full">
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-2 border-r border-line bg-surface-2 p-3 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${expanded ? "lg:w-60" : "lg:w-[76px] lg:items-center"} ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`mb-2 flex items-center justify-between ${expanded ? "" : "lg:justify-center"}`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue text-white" aria-hidden>
            <GraduationCap size={20} />
          </span>
          <span className={`ml-2 mr-auto text-lg font-bold ${expanded ? "" : "lg:hidden"}`}>EduMaster<span className="text-cyan">.ai</span></span>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1.5">
          {items.map((n) => <RailLink key={n.to} item={n} expanded={expanded} onClick={() => setOpen(false)} badge={n.badgeKey === "messages" ? unread.data?.unread ?? 0 : 0} />)}
        </nav>
        <div className={`mt-auto flex flex-col gap-1.5 ${expanded ? "" : "lg:items-center"}`}>
          {showSettings && (
            <nav aria-label="Configuración">
              <RailLink item={SETTINGS} expanded={expanded} onClick={() => setOpen(false)} />
            </nav>
          )}
          <button type="button" onClick={toggleRail} aria-expanded={expanded}
            aria-label={expanded ? "Contraer menú" : "Expandir menú"} title={expanded ? "Contraer menú" : "Expandir menú"}
            className={`hidden h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted transition hover:bg-ink/5 hover:text-ink lg:flex ${expanded ? "w-full" : "w-11 justify-center px-0"}`}>
            {expanded ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            {expanded && <span>Contraer menú</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:px-7">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="min-w-0 flex-1 basis-32">
            <p className="truncate text-sm font-semibold">{me?.organization_name}</p>
            <p className="truncate text-xs text-muted">{ROLE_LABEL[me?.role ?? ""]} · Aprende, practica, destaca</p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            <form onSubmit={search} role="search" className="hidden md:block">
              <label className="relative block">
                <span className="sr-only">Buscar cursos</span>
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input w-64 pl-9" placeholder="Buscar cursos…" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            </form>
            <LivePill />
            {me?.organization_is_demo && <DemoBadge />}
            <ThemeToggle />
            <Notifications />
            <div className="hidden text-right xl:block">
              <p className="text-sm font-semibold leading-tight">{me?.full_name}</p>
              <p className="text-[11px] text-muted">{ROLE_LABEL[me?.role ?? ""]}</p>
            </div>
            <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-blue text-xs font-bold text-white sm:flex" aria-hidden>{initials}</span>
            <button className="btn btn-ghost px-2" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function LivePill() {
  const { status, lastEventAt } = useRealtime();
  const [liveAt, setLiveAt] = useState(0);
  const [, setTick] = useState(0);
  useRealtimeEvent(["model.inference.live"], () => setLiveAt(Date.now()));
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const inferring = status === "conectado" && Date.now() - liveAt < 15_000;
  if (inferring) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/45 bg-violet/10 px-3 py-1.5 text-xs font-bold text-violet">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet" /> <span className="hidden sm:inline">Inferencia en vivo</span>
      </span>
    );
  }
  const tone = status === "conectado" ? "bg-teal" : status === "sin_conexion" ? "bg-danger" : "bg-warn";
  const label = status === "conectado" ? "En vivo" : status === "sin_conexion" ? "Sin conexión" : "Reconectando";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" title={lastEventAt ? `Último evento ${timeAgo(lastEventAt)}` : "Sin eventos aún"}>
      <span className={`h-2 w-2 rounded-full ${tone} ${status === "conectado" ? "animate-pulse" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
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
      <button className="btn btn-ghost relative px-2" onClick={() => setOpen((o) => !o)} aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}>
        <Bell size={16} />
        {unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-blue px-1.5 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="panel absolute right-0 top-11 z-50 w-80 p-2 shadow-xl">
          {(q.data ?? []).length === 0 && <p className="p-3 text-sm text-muted">Sin notificaciones</p>}
          {(q.data ?? []).slice(0, 8).map((n) => (
            <div key={n.id} className="rounded-lg p-2 hover:bg-ink/5">
              <p className="flex items-center gap-2 text-sm font-medium"><ClipboardList size={13} className="text-cyan" />{n.title}</p>
              <p className="text-xs text-muted">{n.body}</p>
              <p className="text-[10px] text-muted">{timeAgo(n.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
