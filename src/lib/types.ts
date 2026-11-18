export type Role =
  | "superadmin"
  | "admin"
  | "coordinador"
  | "docente"
  | "estudiante"
  | "analista"
  | "ml_engineer"
  | "auditor";

export interface Me {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  organization_id: string;
  organization_name: string;
  organization_is_demo: boolean;
  student_id: string | null;
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  previous: number | null;
  change: number | null;
  unit: string;
  as_of: string;
  source: string;
}

export interface Summary {
  period_days: number;
  kpis: Kpi[];
  is_demo: boolean;
  generated_at: string;
  model: null | {
    version: number;
    deployed_at: string;
    dataset_demo: boolean;
    completion_pr_auc: number | null;
    completion_roc_auc: number | null;
    risk_pr_auc: number | null;
    supera_baseline: boolean;
  };
}

export interface WeekPoint {
  week_start: string;
  active_students: number;
  events: number;
  activities: number;
  completions: number;
  hours: number;
  avg_score: number | null;
}

export interface Layer {
  name: string;
  type: string;
  group: "entrada" | "oculta" | "temporal" | "fusion" | "salida";
  inputs: number;
  neurons: number;
  params: number;
  param_bytes: number;
  training_bytes: number;
  activation_bytes: number;
  total_bytes: number;
  memory_share: number;
  note: string;
}

export interface Architecture {
  name: string;
  config: { tab_hidden: number[]; gru_hidden: number; fusion_hidden: number; seq_len: number; n_tabular: number };
  batch_size: number;
  layers: Layer[];
  total_params: number;
  total_bytes: number;
  heaviest_dense_layer: string;
  explanation: string;
  version?: number;
  stage?: string;
  training_active?: boolean;
}

export interface Recommendation {
  id: string;
  type: string;
  title: string;
  rationale: string;
  impact: string;
  score: number;
  status: string;
  useful: boolean | null;
  created_at: string;
  student: { id: string; full_name: string };
  course: { id: string; title: string } | null;
  skill: { id: string; name: string } | null;
}

export interface RealtimeEvent<P = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  occurred_at: string;
  organization_id: string;
  aggregate_id: string | null;
  payload: P;
}
