import { useState } from "react";
import type { NetState } from "../components/NeuralNetworkCanvas";
import { useRealtimeEvent } from "./realtime";

export interface EpochPoint {
  epoch: number;
  train_loss: number;
  val_loss: number;
}

export interface TrainingLive {
  state: NetState;
  runId: string | null;
  epoch: number;
  epochs: number;
  history: EpochPoint[];
  error: string | null;
  updatedAt: string | null;
}

export function useTrainingLive(initialActive = false): TrainingLive {
  const [live, setLive] = useState<TrainingLive>({
    state: initialActive ? "entrenando" : "detenido", runId: null, epoch: 0, epochs: 0, history: [], error: null, updatedAt: null,
  });
  useRealtimeEvent(
    ["model.training.queued", "model.training.started", "model.training.progress", "model.training.completed", "model.training.failed", "model.deployed"],
    (ev) => {
      const p = ev.payload as Record<string, unknown>;
      setLive((cur) => {
        const runId = (p.run_id as string) ?? cur.runId;
        const fresh = runId !== cur.runId;
        const base = fresh ? { ...cur, history: [], epoch: 0, error: null } : cur;
        switch (ev.event_type) {
          case "model.training.queued":
            return { ...base, runId, state: "en_cola", updatedAt: ev.occurred_at };
          case "model.training.started":
            return { ...base, runId, state: "cargando_datos", updatedAt: ev.occurred_at };
          case "model.training.progress": {
            const status = (p.status as NetState) ?? "entrenando";
            if (typeof p.epoch === "number") {
              const point = { epoch: p.epoch, train_loss: p.train_loss as number, val_loss: p.val_loss as number };
              return { ...base, runId, state: status, epoch: p.epoch, epochs: (p.epochs as number) ?? base.epochs,
                history: [...base.history.filter((h) => h.epoch !== p.epoch), point], updatedAt: ev.occurred_at };
            }
            return { ...base, runId, state: status, updatedAt: ev.occurred_at };
          }
          case "model.training.completed":
          case "model.deployed":
            return { ...base, runId, state: "publicado", updatedAt: ev.occurred_at };
          case "model.training.failed":
            return { ...base, runId, state: "error", error: (p.error as string) ?? "Error", updatedAt: ev.occurred_at };
          default:
            return cur;
        }
      });
    },
  );
  return live;
}

export const STATE_LABEL: Record<NetState, string> = {
  detenido: "Detenido",
  en_cola: "En cola",
  cargando_datos: "Cargando datos",
  entrenando: "Entrenando",
  validando: "Validando",
  publicado: "Publicado",
  inferencia: "Inferencia activa",
  error: "Error",
};
