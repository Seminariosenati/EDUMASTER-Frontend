import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { streamUrl } from "./api";
import type { RealtimeEvent } from "./types";

type Status = "conectando" | "conectado" | "reconectando" | "sin_conexion";
type Listener = (ev: RealtimeEvent) => void;

interface RealtimeValue {
  status: Status;
  lastEventAt: string | null;
  subscribe: (types: string[] | "*", fn: Listener) => () => void;
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

const EVENT_TYPES = [
  "learning.progress.updated",
  "assessment.submitted",
  "course.completed",
  "recommendation.created",
  "notification.created",
  "model.training.queued",
  "model.training.started",
  "model.training.progress",
  "model.training.completed",
  "model.training.failed",
  "model.deployed",
  "system.resources",
];

const INVALIDATIONS: Record<string, string[][]> = {
  "learning.progress.updated": [["summary"], ["progress"], ["completion"], ["courses"], ["student-progress"]],
  "assessment.submitted": [["summary"], ["activity"], ["skills"], ["progress"]],
  "course.completed": [["summary"], ["activity"], ["completion"], ["certificates"]],
  "recommendation.created": [["recommendations"], ["activity"]],
  "notification.created": [["notifications"], ["activity"], ["certificates"]],
  "model.training.completed": [["models"], ["runs"], ["activity"]],
  "model.training.failed": [["runs"]],
  "model.deployed": [["models"], ["architecture"], ["summary"], ["activity"]],
};

export function RealtimeProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("conectando");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const listeners = useRef(new Set<{ types: string[] | "*"; fn: Listener }>());

  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let pendingInvalidations = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      for (const key of pendingInvalidations) qc.invalidateQueries({ queryKey: [key] });
      pendingInvalidations = new Set();
      flushTimer = undefined;
    };

    const handle = (raw: MessageEvent) => {
      const ev = JSON.parse(raw.data) as RealtimeEvent;
      if (ev.event_type !== "system.resources") setLastEventAt(new Date().toISOString());
      for (const l of listeners.current) {
        if (l.types === "*" || l.types.includes(ev.event_type)) l.fn(ev);
      }
      for (const key of INVALIDATIONS[ev.event_type] ?? []) pendingInvalidations.add(key[0]);
      if (pendingInvalidations.size && !flushTimer) flushTimer = setTimeout(flush, 800);
    };

    const connect = () => {
      if (closed) return;
      es = new EventSource(streamUrl());
      es.addEventListener("ready", () => {
        retry = 0;
        setStatus("conectado");
        qc.invalidateQueries();
      });
      for (const t of EVENT_TYPES) es.addEventListener(t, handle as EventListener);
      es.onerror = () => {
        es?.close();
        setStatus(retry > 3 ? "sin_conexion" : "reconectando");
        const delay = Math.min(30_000, 1000 * 2 ** retry++);
        timer = setTimeout(connect, delay);
      };
    };
    connect();
    return () => {
      closed = true;
      es?.close();
      clearTimeout(timer);
      clearTimeout(flushTimer);
    };
  }, [enabled, qc]);

  const subscribe = useCallback((types: string[] | "*", fn: Listener) => {
    const entry = { types, fn };
    listeners.current.add(entry);
    return () => {
      listeners.current.delete(entry);
    };
  }, []);
  const value = useMemo<RealtimeValue>(() => ({ status, lastEventAt, subscribe }), [status, lastEventAt, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime fuera de RealtimeProvider");
  return ctx;
}

export function useRealtimeEvent(types: string[] | "*", fn: Listener) {
  const { subscribe } = useRealtime();
  const ref = useRef(fn);
  ref.current = fn;
  const key = types === "*" ? "*" : types.join(",");
  useEffect(() => subscribe(types, (ev) => ref.current(ev)), [subscribe, key]); // eslint-disable-line react-hooks/exhaustive-deps
}
