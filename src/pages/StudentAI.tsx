import { useQuery } from "@tanstack/react-query";
import { BrainCircuit } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NeuralNetworkCanvas } from "../components/NeuralNetworkCanvas";
import { Badge, EmptyState, ErrorState, Note, Panel, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { fmtPercent } from "../lib/format";
import type { Architecture } from "../lib/types";

interface Factor {
  variable: string;
  descripcion: string;
  efecto: "aumenta" | "disminuye";
  peso: number;
}

interface CoursePrediction {
  course_id: string;
  completion_probability: number;
  risk_probability: number;
  mastery_level: string;
  mastery_distribution: Record<string, number>;
  skill_scores: Record<string, number>;
  explanation: { finalizacion: Factor[]; riesgo: Factor[] };
  activations: Record<string, number[]>;
}

const LEVELS = ["principiante", "elemental", "intermedio", "avanzado", "experto"];

export function StudentAI({ studentId, courseTitles }: { studentId: string; courseTitles: Record<string, string> }) {
  const arch = useQuery({ queryKey: ["architecture", "active"], queryFn: () => api<Architecture>("/ml/models/active/architecture"), retry: false });
  const skills = useQuery({ queryKey: ["skill-list"], queryFn: () => api<{ id: string; name: string }[]>("/skills") });
  const preds = useQuery({
    queryKey: ["student-ai", studentId],
    queryFn: () => api<{ model_version: number; disclaimer: string; predictions: CoursePrediction[] }>("/ml/predictions", {
      method: "POST", json: { student_id: studentId },
    }),
    retry: false,
  });
  const [courseId, setCourseId] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const list = preds.data?.predictions ?? [];
  const current = list.find((p) => p.course_id === courseId) ?? list[0];

  useEffect(() => {
    setCourseId(null);
  }, [studentId]);
  useEffect(() => {
    if (!current) return;
    setAnimating(true);
    const id = setTimeout(() => setAnimating(false), 3000);
    return () => clearTimeout(id);
  }, [current?.course_id, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const skillName = useMemo(() => Object.fromEntries((skills.data ?? []).map((s) => [s.id, s.name])), [skills.data]);
  const topSkills = current
    ? Object.entries(current.skill_scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => skillName[id] ?? "—")
    : [];

  return (
    <Panel glow={animating} icon={<BrainCircuit size={16} />} title="Análisis de IA"
      subtitle={preds.data ? <span className="font-mono">edumaster-mtl v{preds.data.model_version} · inferencia con sus datos actuales</span> : undefined}
      actions={<Badge tone={animating ? "violet" : "muted"}>{animating ? "Inferencia activa" : "Detenido"}</Badge>}>
      {preds.isLoading || arch.isLoading ? <Skeleton className="h-80" /> : preds.error ? <ErrorState error={preds.error} /> : !current ? (
        <EmptyState message="Sin cursos en curso para estimar (los cursos completados no se predicen)." icon={<BrainCircuit size={22} />} />
      ) : (
        <div className="space-y-3">
          {list.length > 1 && (
            <div role="tablist" aria-label="Curso" className="flex flex-wrap gap-1.5">
              {list.map((p) => (
                <button key={p.course_id} role="tab" aria-selected={p.course_id === current.course_id}
                  onClick={() => setCourseId(p.course_id)}
                  className={`btn px-3 py-1.5 text-xs ${p.course_id === current.course_id ? "btn-primary" : "btn-ghost"}`}>
                  {courseTitles[p.course_id] ?? "Curso"}
                </button>
              ))}
            </div>
          )}
          {arch.data && (
            <NeuralNetworkCanvas architecture={arch.data} state={animating ? "inferencia" : "detenido"} activations={current.activations} height={260} compact />
          )}
          <div className="grid grid-cols-2 border-t border-line sm:grid-cols-4 [&>*:not(:first-child)]:sm:border-l [&>*]:border-line">
            <Out label="Finalización en 28 días" value={fmtPercent(current.completion_probability)} tone="text-teal" />
            <Out label="Dominio estimado" value={current.mastery_level} tone="text-violet capitalize" />
            <Out label="Señal de riesgo" value={fmtPercent(current.risk_probability)} tone="text-danger" />
            <Out label="Reforzar primero" value={topSkills[0] ?? "—"} tone="text-cyan" />
          </div>
          <div className="-mx-4 grid border-t border-line md:grid-cols-2">
            <div className="p-4">
              <p className="mb-3 text-sm font-semibold">Distribución del dominio</p>
              {LEVELS.map((l) => (
                <div key={l} className="mb-1.5 flex items-center gap-2 text-xs">
                  <span className="w-20 capitalize">{l}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-blue" style={{ width: `${(current.mastery_distribution[l] ?? 0) * 100}%` }} /></div>
                  <span className="w-11 text-right tabular-nums text-muted">{fmtPercent(current.mastery_distribution[l] ?? 0)}</span>
                </div>
              ))}
              <p className="mt-2 text-xs text-muted">Competencias a reforzar: <b className="text-ink">{topSkills.join(" → ")}</b></p>
            </div>
            <div className="border-line p-4 text-xs md:border-l">
              <p className="mb-2 text-sm font-semibold">Por qué la red estima esto <span className="font-normal text-muted">· gradiente × entrada</span></p>
              <FactorList title="Riesgo" factors={current.explanation.riesgo} goodWhen="disminuye" />
              <FactorList title="Finalización" factors={current.explanation.finalizacion} goodWhen="aumenta" />
            </div>
          </div>
          <Note>{preds.data?.disclaimer} Úsala para acompañar al estudiante, nunca para sancionarlo.</Note>
        </div>
      )}
    </Panel>
  );
}

function Out({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0 py-3 sm:px-4 sm:first:pl-0">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-lg font-bold ${tone}`} title={value}>{value}</p>
    </div>
  );
}

function FactorList({ title, factors, goodWhen }: { title: string; factors: Factor[]; goodWhen: "aumenta" | "disminuye" }) {
  return (
    <div className="mb-2">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {factors.map((f) => (
          <li key={f.variable} className="flex justify-between gap-2">
            <span>{f.descripcion}</span>
            <span className={f.efecto === goodWhen ? "text-teal" : "text-danger"}>{f.efecto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
