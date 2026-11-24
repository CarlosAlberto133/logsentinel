const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface ProjectItem {
  id: string;
  name: string;
  environment: string;
  api_key_prefix: string;
  created_at: string;
}

export interface ProjectCreated extends ProjectItem {
  api_key: string;
}

export interface ClusterListItem {
  id: string;
  project_id: string;
  title: string;
  status: "OPEN" | "RESOLVED";
  occurrence_count: number;
  last_seen_at: string;
}

export interface HourlyMetric {
  hour: string;
  count: number;
}

export interface FileMetric {
  file: string;
  count: number;
}

export interface DashboardSummary {
  active_clusters: number;
  resolved_clusters: number;
  events_24h: number;
  anomalies_detected: number;
  hourly_trend: HourlyMetric[];
  top_files: FileMetric[];
  clusters: ClusterListItem[];
}

export interface RecentLogItem {
  id: string;
  cluster_id: string;
  raw_message: string;
  environment: string;
  log_metadata: Record<string, unknown>;
  created_at: string;
}

export interface RcaResult {
  probable_cause: string;
  suggested_fix: string;
  confidence_score: number;
  referenced_clusters: string[];
}

export interface ClusterDetail extends ClusterListItem {
  normalized_stack: string;
  resolution_notes: string | null;
  ai_rca_cache: RcaResult | null;
  hourly_frequency: HourlyMetric[];
}

export async function fetchProjects(): Promise<ProjectItem[]> {
  const res = await fetch(`${API_URL}/projects`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erro ao listar projetos");
  return res.json();
}

export async function createProject(name: string, environment: string): Promise<ProjectCreated> {
  const res = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, environment }),
  });
  if (!res.ok) throw new Error("Erro ao criar projeto");
  return res.json();
}

export async function fetchDashboard(params?: {
  projectId?: string;
  env?: string;
  status?: string;
}): Promise<DashboardSummary> {
  const url = new URL(`${API_URL}/clusters`);
  if (params?.projectId && params.projectId !== "ALL") url.searchParams.set("project_id", params.projectId);
  if (params?.env && params.env !== "ALL") url.searchParams.set("env", params.env);
  if (params?.status && params.status !== "ALL") url.searchParams.set("status", params.status);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Erro ao carregar dashboard");
  return res.json();
}

export async function fetchRecentLogs(params?: {
  projectId?: string;
  env?: string;
}): Promise<RecentLogItem[]> {
  const url = new URL(`${API_URL}/clusters/logs/recent`);
  if (params?.projectId && params.projectId !== "ALL") url.searchParams.set("project_id", params.projectId);
  if (params?.env && params.env !== "ALL") url.searchParams.set("env", params.env);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Erro ao carregar logs recentes");
  return res.json();
}

export async function fetchClusterDetail(id: string): Promise<ClusterDetail> {
  const res = await fetch(`${API_URL}/clusters/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erro ao carregar detalhes do cluster");
  return res.json();
}

export async function analyzeClusterRca(id: string): Promise<RcaResult> {
  const res = await fetch(`${API_URL}/clusters/${id}/analyze`, { method: "POST" });
  if (!res.ok) throw new Error("Erro na análise de IA");
  return res.json();
}

export async function resolveCluster(id: string, resolution_notes: string) {
  const res = await fetch(`${API_URL}/clusters/${id}/resolve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolution_notes }),
  });
  if (!res.ok) throw new Error("Erro ao resolver cluster");
  return res.json();
}