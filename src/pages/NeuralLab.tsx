import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, BrainCircuit, Cpu, FlaskConical, Gauge, Pause, Play, Rocket, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LossChart } from "../components/charts";
import { NeuralNetworkCanvas, type NetState } from "../components/NeuralNetworkCanvas";
import { Badge, EmptyState, ErrorState, Field, Note, PageHeader, Panel, QueryState, Skeleton } from "../components/ui";
import { ArchitectureTable, ResourceMonitor } from "../components/widgets";
import { api, ApiError } from "../lib/api";
import { ML_MANAGERS, STAFF, useAuth } from "../lib/auth";
import { fmtBytes, fmtDate, fmtNumber, fmtPercent } from "../lib/format";
import { STATE_LABEL, useTrainingLive } from "../lib/training";
import type { Architecture } from "../lib/types";

interface ModelVersion {
  id: string;
  version: number;
  stage: string;
  approval_status: string;
  created_at: string;
  deployed_at: string | null;
  supera_baseline: boolean;
  total_params: number;
  metrics: { test?: Record<string, Record<string, number | null>>; baseline?: Record<string, Record<string, number | null>> };
  config: Architecture["config"];
}

interface Prediction {
  course_id: string;
  completion_probability: number;
  risk_probability: number;
  mastery_level: string;
  explanation: Record<string, { variable: string; descripcion: string; efecto: string; peso: number }[]>;
  activations: Record<string, number[]>;
}

interface Run {
  id: string;
  status: string;
  params: Record<string, unknown>;
  history: { epoch: number; train_loss: number; val_loss: number }[];
  created_at: string;
  finished_at: string | null;
  error: string | null;
}

const parseHidden = (s: string) => s.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);

export function NeuralLab() {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const isManager = can(...ML_MANAGERS);
  const arch = useQuery({ queryKey: ["architecture", "active"], queryFn: () => api<Architecture>("/ml/models/active/architecture"), retry: false });
  const models = useQuery({ queryKey: ["models"], queryFn: () => api<ModelVersion[]>("/ml/models") });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api<Run[]>("/ml/training-runs?limit=10"), enabled: can(...ML_MANAGERS, ...STAFF) });
  const live = useTrainingLive(arch.data?.training_active);

  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<string | null>("densa_1");
  const [inferring, setInferring] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  const [tabHidden, setTabHidden] = useState("64, 32");
  const [gru, setGru] = useState(32);
  const [fusion, setFusion] = useState(64);
  const [epochs, setEpochs] = useState(40);
  const hidden = parseHidden(tabHidden);

  useEffect(() => {
    if (arch.data) {
      setTabHidden(arch.data.config.tab_hidden.join(", "));
      setGru(arch.data.config.gru_hidden);
      setFusion(arch.data.config.fusion_hidden);
    }
  }, [arch.data]);

  const preview = useQuery({
    queryKey: ["arch-preview", hidden.join("-"), gru, fusion],
    queryFn: () => api<Architecture>("/ml/architecture/preview", { method: "POST", json: { tab_hidden: hidden, gru_hidden: gru, fusion_hidden: fusion } }),
    enabled: hidden.length > 0,
  });

  const train = useMutation({
    mutationFn: () => api<Run>("/ml/training-runs", { method: "POST", json: { tab_hidden: hidden, gru_hidden: gru, fusion_hidden: fusion, epochs } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });

  const promote = useMutation({
    mutationFn: (id: string) => api(`/ml/models/${id}/promote`, { method: "POST", json: { justification: "Aprobado desde el laboratorio tras revisar métricas y baseline" } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  const predict = useMutation({
    mutationFn: (studentId: string) => api<{ predictions: Prediction[] }>("/ml/predictions", { method: "POST", json: { student_id: studentId } }),
    onSuccess: (res) => {
      setPrediction(res.predictions[0] ?? null);
      setInferring(true);
      setTimeout(() => setInferring(false), 4000);
    },
  });

  const netState: NetState = inferring ? "inferencia" : live.state === "publicado" ? "detenido" : live.state;
  const lastRunHistory = runs.data?.find((r) => r.status === "completado")?.history ?? [];
  const history = live.history.length ? live.history : lastRunHistory;
  const selectedLayer = arch.data?.layers.find((l) => l.name === selected);

  return (
    <div className="space-y-4">
      <PageHeader
        title="IA · Red neuronal"
        subtitle="EduMaster Multi-Task Learning Network: rama densa tabular + rama temporal GRU + fusión + 4 cabezas de salida"
        actions={<Badge tone={netState === "error" ? "danger" : netState === "detenido" ? "muted" : "violet"}>{STATE_LABEL[netState]}</Badge>}
      />

      {arch.error instanceof ApiError && arch.error.status === 404 ? (
        <Panel><EmptyState message="Aún no hay un modelo publicado. Inicia un entrenamiento abajo." icon={<BrainCircuit size={22} />} /></Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          <Panel
            glow className="xl:col-span-3" icon={<BrainCircuit size={16} />} title="Arquitectura animada"
            subtitle="Haz clic en una capa para inspeccionarla. Los pulsos solo aparecen durante entrenamiento o inferencia reales."
            actions={
              <>
                <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Reanudar" : "Pausar"}>
                  {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? "Reanudar" : "Pausar"}
                </button>
                <label className="flex items-center gap-1 text-xs text-muted">
                  Velocidad
                  <input type="range" min={0.25} max={3} step={0.25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Velocidad de animación" />
                </label>
              </>
            }
          >
            {arch.isLoading ? <Skeleton className="h-96" /> : arch.data && (
              <NeuralNetworkCanvas architecture={arch.data} state={netState} activations={prediction?.activations} paused={paused}
                speed={speed} height={400} selected={selected} onSelect={setSelected} />
            )}
            {live.state === "entrenando" && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted"><span>Época {live.epoch} de {live.epochs}</span><span>loss val {live.history.at(-1)?.val_loss.toFixed(4)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full bg-violet transition-all" style={{ width: `${(live.epoch / Math.max(live.epochs, 1)) * 100}%` }} /></div>
              </div>
            )}
            {live.state === "error" && <p className="mt-2 text-sm text-danger">El entrenamiento falló: {live.error}</p>}
          </Panel>

          <Panel icon={<Search size={16} />} title="Inspector de capa">
            {selectedLayer ? (
              <div className="space-y-2 text-sm">
                <p className="text-lg font-semibold text-cyan">{selectedLayer.name}</p>
                <p className="text-xs text-muted">{selectedLayer.type}{selectedLayer.note && ` · ${selectedLayer.note}`}</p>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <Dt label="Entradas" value={fmtNumber(selectedLayer.inputs)} />
                  <Dt label="Neuronas" value={fmtNumber(selectedLayer.neurons)} />
                  <Dt label="Parámetros" value={fmtNumber(selectedLayer.params)} />
                  <Dt label="Pesos" value={fmtBytes(selectedLayer.param_bytes)} />
                  <Dt label="Activaciones (lote)" value={fmtBytes(selectedLayer.activation_bytes)} />
                  <Dt label="% memoria del modelo" value={fmtPercent(selectedLayer.memory_share)} />
                </dl>
                {prediction?.activations[selectedLayer.name] && (
                  <div>
                    <p className="mb-1 text-xs text-muted">Activaciones del ejemplo ({prediction.activations[selectedLayer.name].length})</p>
                    <div className="flex h-12 items-end gap-px">
                      {prediction.activations[selectedLayer.name].slice(0, 64).map((v, i, arr) => {
                        const max = Math.max(...arr.map(Math.abs), 1e-6);
                        return <div key={i} className={v >= 0 ? "bg-cyan/70" : "bg-violet/70"} style={{ flex: 1, height: `${(Math.abs(v) / max) * 100}%` }} title={v.toFixed(3)} />;
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : <EmptyState message="Selecciona una capa" />}
          </Panel>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <InferencePanel me={me} onPredict={(id) => predict.mutate(id)} busy={predict.isPending} prediction={prediction} error={predict.error} />
        <Panel icon={<Cpu size={16} />} title="Administrador de tareas del servidor" subtitle="CPU y memoria en vivo; observa el pico al entrenar">
          <ResourceMonitor />
        </Panel>
      </div>

      <Panel icon={<Gauge size={16} />} title="Capas, neuronas y memoria"
        subtitle="Qué capa Dense requiere más memoria y qué pasa si agregas neuronas">
        {arch.data ? (
          <>
            <ArchitectureTable arch={arch.data} />
            <div className="mt-3"><Note>{arch.data.explanation}</Note></div>
          </>
        ) : <Skeleton className="h-40" />}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={<FlaskConical size={16} />} title="Experimentar con neuronas" subtitle="Compara memoria antes de entrenar">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Capas densas (neuronas)" hint="Ej: 128, 64, 32"><input className="input" value={tabHidden} onChange={(e) => setTabHidden(e.target.value)} /></Field>
            <Field label="GRU"><input className="input" type="number" min={4} max={512} value={gru} onChange={(e) => setGru(Number(e.target.value))} /></Field>
            <Field label="Fusión"><input className="input" type="number" min={4} max={1024} value={fusion} onChange={(e) => setFusion(Number(e.target.value))} /></Field>
            <Field label="Épocas"><input className="input" type="number" min={1} max={300} value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} /></Field>
          </div>
          <div className="mt-3">
            {preview.data && arch.data && (
              <>
                <p className="mb-2 text-sm">
                  Total: <b className="text-cyan">{fmtNumber(preview.data.total_params)}</b> parámetros ({fmtBytes(preview.data.total_bytes)}) vs actual {fmtNumber(arch.data.total_params)} ({fmtBytes(arch.data.total_bytes)}).
                  Capa densa más pesada: <b className="text-violet">{preview.data.heaviest_dense_layer}</b>.
                </p>
                <ArchitectureTable arch={preview.data} compareTo={arch.data} compact />
              </>
            )}
            {preview.error && <ErrorState error={preview.error} />}
          </div>
          {isManager ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn btn-primary" disabled={!hidden.length || train.isPending || ["en_cola", "cargando_datos", "entrenando", "validando"].includes(live.state)} onClick={() => train.mutate()}>
                <Rocket size={15} /> Entrenar con esta configuración
              </button>
              {train.error && <span className="text-sm text-danger">{(train.error as Error).message}</span>}
              <span className="text-xs text-muted">Corre en un worker asíncrono; nunca en el hilo HTTP.</span>
            </div>
          ) : <p className="mt-3 text-xs text-muted">Solo ML Engineer o Administración pueden lanzar entrenamientos.</p>}
        </Panel>

        <Panel icon={<Activity size={16} />} title="Curva de entrenamiento" subtitle={live.history.length ? "En vivo desde el worker" : "Último entrenamiento completado"}>
          {history.length ? <LossChart history={history} /> : <EmptyState message="Sin historial de entrenamiento todavía" />}
          <Note>La pérdida es multitarea: L = λ1·BCE(finalización) + λ2·CE(dominio) + λ3·BCE(riesgo) + λ4·ListNet(recomendación). Se detiene antes (early stopping) si la validación deja de mejorar.</Note>
        </Panel>
      </div>

      <Panel icon={<ShieldCheck size={16} />} title="Registro de modelos" subtitle="Solo se promueve a producción lo que supera al baseline interpretable">
        <QueryState q={models} skeleton="h-32" empty={(d) => !d.length}>
          {(d) => (
            <div className="overflow-x-auto">
              <table className="data min-w-[760px]">
                <thead><tr><th>Versión</th><th>Etapa</th><th>Capas densas</th><th className="text-right">Parámetros</th><th className="text-right">PR-AUC finalización</th><th className="text-right">Baseline</th><th className="text-right">PR-AUC riesgo</th><th>Creado</th><th /></tr></thead>
                <tbody>
                  {d.map((m) => (
                    <tr key={m.id}>
                      <td className="font-semibold">v{m.version}</td>
                      <td><Badge tone={m.stage === "produccion" ? "teal" : m.stage === "archivado" ? "muted" : "blue"}>{m.stage}</Badge></td>
                      <td className="tabular-nums">{m.config?.tab_hidden?.join(" → ")}</td>
                      <td className="text-right tabular-nums">{fmtNumber(m.total_params)}</td>
                      <td className="text-right tabular-nums">{m.metrics.test?.finalizacion?.pr_auc ?? "—"}</td>
                      <td className="text-right tabular-nums text-muted">{m.metrics.baseline?.finalizacion?.pr_auc ?? "—"}</td>
                      <td className="text-right tabular-nums">{m.metrics.test?.riesgo?.pr_auc ?? "—"}</td>
                      <td className="text-xs text-muted">{fmtDate(m.created_at)}</td>
                      <td>
                        {isManager && m.stage !== "produccion" && (
                          <button className="btn btn-ghost px-2 py-1 text-xs" disabled={!m.supera_baseline || promote.isPending} onClick={() => promote.mutate(m.id)}
                            title={m.supera_baseline ? "Promover a producción" : "No supera al baseline"}>
                            Promover
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
        {runs.data && runs.data.some((r) => r.status === "error") && (
          <p className="mt-2 text-xs text-danger">Hay entrenamientos con error: {runs.data.find((r) => r.status === "error")?.error}</p>
        )}
      </Panel>
    </div>
  );
}

function Dt({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.02] p-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function InferencePanel({ me, onPredict, busy, prediction, error }: {
  me: ReturnType<typeof useAuth>["me"]; onPredict: (id: string) => void; busy: boolean; prediction: Prediction | null; error: unknown;
}) {
  const isStudent = me?.role === "estudiante";
  const [q, setQ] = useState("");
  const students = useQuery({
    queryKey: ["students", "lab", q],
    queryFn: () => api<{ items: { id: string; full_name: string; external_code: string }[] }>(`/students?limit=8&q=${encodeURIComponent(q)}`),
    enabled: !isStudent,
  });
  const factors = useMemo(() => prediction?.explanation, [prediction]);
  return (
    <Panel icon={<Play size={16} />} title="Probar con un ejemplo real (inferencia)" subtitle="La propagación hacia adelante se anima con las activaciones devueltas por el modelo">
      {isStudent ? (
        <button className="btn btn-primary" disabled={busy} onClick={() => me?.student_id && onPredict(me.student_id)}>Ver mi estimación</button>
      ) : (
        <>
          <input className="input" placeholder="Buscar estudiante por nombre o código DEMO-…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {students.data?.items.map((s) => (
              <button key={s.id} className="btn btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => onPredict(s.id)}>{s.full_name} · {s.external_code}</button>
            ))}
          </div>
        </>
      )}
      {error != null && <div className="mt-3"><ErrorState error={error} /></div>}
      {prediction ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-line p-2"><p className="text-muted">Prob. finalizar (28 días)</p><p className="text-xl font-bold text-teal">{fmtPercent(prediction.completion_probability)}</p></div>
            <div className="rounded-lg border border-line p-2"><p className="text-muted">Señal de desconexión</p><p className="text-xl font-bold text-danger">{fmtPercent(prediction.risk_probability)}</p></div>
            <div className="rounded-lg border border-line p-2"><p className="text-muted">Dominio estimado</p><p className="text-xl font-bold capitalize text-violet">{prediction.mastery_level}</p></div>
          </div>
          {factors && (
            <div className="text-xs">
              <p className="mb-1 text-muted">Factores principales (gradiente × entrada):</p>
              <ul className="space-y-0.5">
                {factors.riesgo.map((f) => <li key={f.variable}>• {f.descripcion} <span className={f.efecto === "aumenta" ? "text-danger" : "text-teal"}>{f.efecto} el riesgo</span></li>)}
              </ul>
            </div>
          )}
          <Note>Es una estimación del modelo, no una calificación oficial ni un diagnóstico. Úsala para apoyar, nunca para sancionar.</Note>
        </div>
      ) : !error && <p className="mt-3 text-xs text-muted">Elige un ejemplo para ver la inferencia.</p>}
    </Panel>
  );
}
