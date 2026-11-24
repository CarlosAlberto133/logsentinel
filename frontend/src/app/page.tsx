"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Flame,
  KeyRound,
  Layers,
  Plus,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import {
  analyzeClusterRca,
  ClusterDetail,
  createProject,
  DashboardSummary,
  fetchClusterDetail,
  fetchDashboard,
  fetchProjects,
  fetchRecentLogs,
  ProjectCreated,
  ProjectItem,
  RecentLogItem,
  resolveCluster,
} from "@/lib/api";
import { ExceptionsAreaChart, SparklineArea, TopFilesChart } from "@/components/Charts";

type TabType = "overview" | "livetail" | "apikeys";

export default function LogSentinelApp() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedEnv, setSelectedEnv] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [livePolling, setLivePolling] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Dados das Views
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLogItem[]>([]);

  // View Detalhada do Cluster (Tela 4 - Split View)
  const [selectedCluster, setSelectedCluster] = useState<ClusterDetail | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [copiedStack, setCopiedStack] = useState(false);

  // Modal Criar Projeto / API Key (Tela 3)
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjEnv, setNewProjEnv] = useState("production");
  const [createdProject, setCreatedProject] = useState<ProjectCreated | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  async function refreshAll() {
    setLoading(true);
    try {
      const [projList, dashData, logsData] = await Promise.all([
        fetchProjects(),
        fetchDashboard({ projectId: selectedProject, env: selectedEnv, status: statusFilter }),
        fetchRecentLogs({ projectId: selectedProject, env: selectedEnv }),
      ]);
      setProjects(projList);
      setDashboard(dashData);
      setRecentLogs(logsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, [selectedProject, selectedEnv, statusFilter]);

  // Auto-Refresh a cada 5s quando "Live 5s" estiver ativado
  useEffect(() => {
    if (!livePolling) return;
    const timer = setInterval(() => {
      refreshAll();
    }, 5000);
    return () => clearInterval(timer);
  }, [livePolling, selectedProject, selectedEnv, statusFilter]);

  async function openClusterDetail(id: string) {
    try {
      const detail = await fetchClusterDetail(id);
      setSelectedCluster(detail);
      setResolutionNotes(detail.resolution_notes || "");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRunRca() {
    if (!selectedCluster) return;
    setAnalyzing(true);
    try {
      const rca = await analyzeClusterRca(selectedCluster.id);
      setSelectedCluster({ ...selectedCluster, ai_rca_cache: rca });
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCluster || resolutionNotes.trim().length < 5) return;
    setResolving(true);
    try {
      await resolveCluster(selectedCluster.id, resolutionNotes);
      setSelectedCluster({
        ...selectedCluster,
        status: "RESOLVED",
        resolution_notes: resolutionNotes,
      });
      await refreshAll();
    } catch (err) {
      console.error(err);
    } finally {
      setResolving(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (newProjName.trim().length < 2) return;
    try {
      const created = await createProject(newProjName.trim(), newProjEnv);
      setCreatedProject(created);
      setNewProjName("");
      await refreshAll();
    } catch (err) {
      console.error(err);
    }
  }

  const hourlyValues = dashboard?.hourly_trend.map((h) => h.count) || [];

  return (
    <div className="flex min-h-screen bg-[#0b0e14] text-zinc-100">
      {/* Sidebar Persistente (Estilo BetterStack / Logz.io) */}
      <aside className="flex w-60 flex-col border-r border-zinc-800/80 bg-[#0f131a]">
        <div className="flex items-center gap-3 border-b border-zinc-800/80 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-white">LogSentinel</span>
            <p className="text-[11px] text-zinc-500">AI Telemetry</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3 text-sm">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
              activeTab === "overview"
                ? "bg-sky-500/15 font-medium text-sky-300 ring-1 ring-sky-500/30"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            Error Tracking
          </button>

          <button
            onClick={() => setActiveTab("livetail")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
              activeTab === "livetail"
                ? "bg-sky-500/15 font-medium text-sky-300 ring-1 ring-sky-500/30"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            <Radio className="h-4 w-4" />
            Live Tail
          </button>

          <button
            onClick={() => setActiveTab("apikeys")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
              activeTab === "apikeys"
                ? "bg-sky-500/15 font-medium text-sky-300 ring-1 ring-sky-500/30"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            API Keys
          </button>
        </nav>

        <div className="border-t border-zinc-800/80 p-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>pgvector + MiniLM-L6</span>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex flex-1 flex-col">
        {/* Top Bar Global */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 bg-[#0f131a]/80 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Telemetry</span>
            <span>›</span>
            <span className="font-medium text-zinc-200">
              {activeTab === "overview"
                ? "Error tracking"
                : activeTab === "livetail"
                ? "Live tail"
                : "API Keys"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro Projeto */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">Projeto: Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Filtro Ambiente */}
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">Ambiente: Todos</option>
              <option value="production">production</option>
              <option value="staging">staging</option>
            </select>

            {/* Toggle Live 5s */}
            <button
              onClick={() => setLivePolling(!livePolling)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                livePolling
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${livePolling ? "animate-ping bg-emerald-400" : "bg-zinc-600"}`} />
              {livePolling ? "Live (5s)" : "Auto: Off"}
            </button>

            <button
              onClick={refreshAll}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-300 hover:bg-zinc-800"
              title="Atualizar agora"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* TELA 1: OVERVIEW & ERROR TRACKING (Estilo Imagem 1) */}
        {activeTab === "overview" && (
          <main className="space-y-6 p-6">
            {/* 4 Cards KPI com Sparklines ao fundo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative overflow-hidden rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                  <span>Total exceptions (24h)</span>
                  <Activity className="h-4 w-4 text-sky-400" />
                </div>
                <p className="relative z-10 mt-3 text-4xl font-bold tracking-tight text-sky-400">
                  {dashboard?.events_24h ?? "—"}
                </p>
                <div className="mt-2">
                  <SparklineArea values={hourlyValues} color="#38bdf8" />
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                  <span>Active error clusters</span>
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                </div>
                <p className="relative z-10 mt-3 text-4xl font-bold tracking-tight text-rose-400">
                  {dashboard?.active_clusters ?? "—"}
                </p>
                <div className="mt-2">
                  <SparklineArea values={hourlyValues.map((v) => Math.ceil(v / 2))} color="#fb7185" />
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                  <span>Resolved (RAG Memory)</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="relative z-10 mt-3 text-4xl font-bold tracking-tight text-emerald-400">
                  {dashboard?.resolved_clusters ?? "—"}
                </p>
                <div className="mt-2">
                  <SparklineArea values={[1, 1, 2, 2, 3, 4, 4]} color="#34d399" />
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                  <span>Anomalies detected</span>
                  <Flame className="h-4 w-4 text-amber-400" />
                </div>
                <p className="relative z-10 mt-3 text-4xl font-bold tracking-tight text-amber-400">
                  {dashboard?.anomalies_detected ?? "—"}
                </p>
                <div className="mt-2">
                  <SparklineArea values={[0, 1, 0, 2, 1, 0, 1]} color="#fbbf24" />
                </div>
              </div>
            </div>

            {/* Trends: Exceptions over time + Top Files */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-800/90 bg-[#121721] p-5 lg:col-span-2">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Exceptions over time (Last 24h)
                </h3>
                <ExceptionsAreaChart data={dashboard?.hourly_trend || []} />
              </div>

              <div className="rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Top files (Stack Trace)
                </h3>
                <TopFilesChart files={dashboard?.top_files || []} />
              </div>
            </div>

            {/* Breakdown Table: Top Errors */}
            <div className="rounded-xl border border-zinc-800/90 bg-[#121721]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
                <h3 className="text-sm font-semibold text-white">Top semantic error clusters</h3>
                <div className="flex gap-1.5">
                  {["ALL", "OPEN", "RESOLVED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        statusFilter === st
                          ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                          : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {st === "ALL" ? "Todos" : st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800/80 text-[11px] uppercase text-zinc-400">
                    <tr>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Type & Normalized Message</th>
                      <th className="px-5 py-3 text-right">Exceptions</th>
                      <th className="px-5 py-3 text-right">Last Seen</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {dashboard?.clusters.map((cluster) => (
                      <tr
                        key={cluster.id}
                        onClick={() => openClusterDetail(cluster.id)}
                        className="cursor-pointer transition hover:bg-zinc-800/40"
                      >
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              cluster.status === "OPEN"
                                ? "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30"
                                : "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
                            }`}
                          >
                            {cluster.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-zinc-200">
                          {cluster.title}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-white">
                          {cluster.occurrence_count.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-zinc-400">
                          {new Date(cluster.last_seen_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs font-medium text-sky-400 hover:underline">
                            View error →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* TELA 2: LIVE TAIL / LOG EXPLORER (Estilo Imagem 2) */}
        {activeTab === "livetail" && (
          <main className="space-y-5 p-6">
            <div className="rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-400">
                  Logs Volume Histogram ({recentLogs.length} eventos recentes)
                </span>
                <span className="font-mono text-xs text-sky-400">Stream em tempo real</span>
              </div>
              <div className="flex h-24 items-end gap-1.5 rounded-lg bg-[#0b0e14] p-3">
                {(dashboard?.hourly_trend || []).map((b) => {
                  const max = Math.max(...(dashboard?.hourly_trend || []).map((x) => x.count), 1);
                  const pct = Math.max(Math.round((b.count / max) * 100), 6);
                  return (
                    <div
                      key={b.hour}
                      style={{ height: `${pct}%` }}
                      title={`${b.hour}: ${b.count} logs`}
                      className={`flex-1 rounded-t transition-all ${
                        b.count > 0 ? "bg-sky-500 hover:bg-sky-400" : "bg-zinc-800"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800/90 bg-[#121721]">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-zinc-800 bg-[#0f131a] text-[11px] uppercase text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Env</th>
                    <th className="px-4 py-3">Raw Message</th>
                    <th className="px-4 py-3 text-right">Cluster</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {recentLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => openClusterDetail(log.cluster_id)}
                      className="cursor-pointer transition hover:bg-zinc-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400">
                        {new Date(log.created_at).toLocaleTimeString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-amber-300">
                          {log.environment}
                        </span>
                      </td>
                      <td className="max-w-xl truncate px-4 py-2.5 text-zinc-200">
                        {log.raw_message}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sky-400">Inspecionar →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>
        )}

        {/* TELA 3: API KEYS & PROJECTS MANAGEMENT (Estilo Imagem 3) */}
        {activeTab === "apikeys" && (
          <main className="space-y-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">API Keys & Projects</h2>
                <p className="text-xs text-zinc-400">
                  Gerencie chaves de ingestão para suas aplicações
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedProject(null);
                  setShowNewKeyModal(true);
                }}
                className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-sky-400"
              >
                <Plus className="h-4 w-4" />
                Create API Key
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
                <span className="text-xs uppercase text-zinc-400">Total Keys</span>
                <p className="mt-2 text-3xl font-bold text-white">{projects.length}</p>
              </div>
              <div className="rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
                <span className="text-xs uppercase text-zinc-400">Active Projects</span>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{projects.length}</p>
              </div>
              <div className="rounded-xl border border-zinc-800/90 bg-[#121721] p-5">
                <span className="text-xs uppercase text-zinc-400">Total Events (24h)</span>
                <p className="mt-2 text-3xl font-bold text-sky-400">{dashboard?.events_24h ?? 0}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800/90 bg-[#121721]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                  <tr>
                    <th className="px-5 py-3">Project Name</th>
                    <th className="px-5 py-3">Key Prefix</th>
                    <th className="px-5 py-3">Environment</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-800/30">
                      <td className="px-5 py-4 font-medium text-white">{p.name}</td>
                      <td className="px-5 py-4 font-mono text-xs text-zinc-300">
                        <span className="rounded bg-zinc-900 px-2.5 py-1 ring-1 ring-zinc-800">
                          {p.api_key_prefix}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-amber-300">{p.environment}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-400 ring-1 ring-emerald-500/30">
                          Active
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-zinc-400">
                        {new Date(p.created_at).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>
        )}
      </div>

      {/* TELA 4: ERROR GROUP DETAIL + AI AGENT SPLIT MODAL (Estilo Imagens 2 e 4) */}
      {selectedCluster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0f131a] shadow-2xl">
            {/* Top Header do Modal */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>Error group summary</span>
                  <span>•</span>
                  <span className="font-mono text-sky-400">
                    {selectedCluster.occurrence_count} occurrences
                  </span>
                </div>
                <h3 className="mt-1 font-mono text-base font-semibold text-white">
                  {selectedCluster.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo Dividido em 2 Colunas */}
            <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
              {/* Coluna Esquerda: Ocorrências + Gráfico + Resolução */}
              <div className="space-y-6 border-b border-zinc-800 p-6 lg:col-span-5 lg:border-b-0 lg:border-r">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-[#121721] p-4 text-xs">
                  <div>
                    <span className="text-zinc-500">Status</span>
                    <p className="mt-1 font-semibold text-white">{selectedCluster.status}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Last seen</span>
                    <p className="mt-1 text-zinc-200">
                      {new Date(selectedCluster.last_seen_at).toLocaleTimeString("pt-BR")}
                    </p>
                  </div>
                </div>

                {/* Gráfico de Ocorrências 24h */}
                <div>
                  <span className="text-xs font-semibold uppercase text-zinc-400">
                    Occurrences (24h)
                  </span>
                  <div className="mt-2 flex h-24 items-end gap-1 rounded-xl border border-zinc-800 bg-[#121721] p-3">
                    {selectedCluster.hourly_frequency.map((h) => {
                      const max = Math.max(
                        ...selectedCluster.hourly_frequency.map((x) => x.count),
                        1
                      );
                      const pct = Math.max(Math.round((h.count / max) * 100), 6);
                      return (
                        <div
                          key={h.hour}
                          style={{ height: `${pct}%` }}
                          title={`${h.hour}: ${h.count} eventos`}
                          className={`flex-1 rounded-t ${
                            h.count > 0 ? "bg-sky-400" : "bg-zinc-800"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Human-in-the-loop: Nota de Resolução */}
                <form onSubmit={handleResolve} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-400">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Resolution Notes (RAG Memory)
                    </label>

                    {selectedCluster.ai_rca_cache && (
                      <button
                        type="button"
                        onClick={() => {
                          const rca = selectedCluster.ai_rca_cache!;
                          setResolutionNotes(
                            `Causa raiz: ${rca.probable_cause}\n\nSolução aplicada:\n${rca.suggested_fix}`
                          );
                        }}
                        className="flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-indigo-500/20"
                        title="Preencher com o diagnóstico e correção gerados pela IA"
                      >
                        <Sparkles className="h-3 w-3" />
                        Usar sugestão da IA
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={4}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Descreva a solução aplicada ou clique em 'Usar sugestão da IA' após rodar a análise..."
                    className="w-full rounded-xl border border-zinc-800 bg-[#121721] p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={resolving || resolutionNotes.trim().length < 5}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {resolving
                      ? "Salvando..."
                      : selectedCluster.status === "RESOLVED"
                      ? "Atualizar Nota de Resolução"
                      : "Marcar como Resolvido"}
                  </button>
                </form>
              </div>

              {/* Coluna Direita: Stack Trace + AI Agent RCA */}
              <div className="space-y-6 p-6 lg:col-span-7">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-400">
                      <Terminal className="h-4 w-4 text-sky-400" />
                      Normalized Stack Trace
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedCluster.normalized_stack);
                        setCopiedStack(true);
                        setTimeout(() => setCopiedStack(false), 2000);
                      }}
                      className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      {copiedStack ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedStack ? "Copied" : "Copy to clipboard"}
                    </button>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-zinc-800 bg-[#0b0e14] p-4 font-mono text-xs leading-relaxed text-zinc-300">
                    {selectedCluster.normalized_stack}
                  </pre>
                </div>

                {/* Painel AI Agent (Estilo Imagem 2) */}
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
                      <Sparkles className="h-4 w-4" />
                      AI Agent • Root Cause Analysis
                    </div>
                    <button
                      onClick={handleRunRca}
                      disabled={analyzing}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      {analyzing ? "Analyzing..." : "Run AI Analysis"}
                    </button>
                  </div>

                  {selectedCluster.ai_rca_cache ? (
                    <div className="mt-4 space-y-4 text-xs">
                      <div className="rounded-lg border border-zinc-800 bg-[#121721] p-3.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-semibold text-indigo-300">Conclusion & Probable Cause</span>
                          <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-indigo-300">
                            Confidence: {selectedCluster.ai_rca_cache.confidence_score}%
                          </span>
                        </div>
                        <p className="leading-relaxed text-zinc-200">
                          {selectedCluster.ai_rca_cache.probable_cause}
                        </p>
                      </div>

                      {selectedCluster.ai_rca_cache.suggested_fix && (
                        <div>
                          <span className="font-semibold text-indigo-300">Suggested Fix:</span>
                          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-zinc-800 bg-[#0b0e14] p-3 font-mono text-emerald-300">
                            {selectedCluster.ai_rca_cache.suggested_fix}
                          </pre>
                        </div>
                      )}

                      {selectedCluster.ai_rca_cache.referenced_clusters?.length > 0 && (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3">
                          <span className="font-semibold text-emerald-300">
                            RAG Memory • Referenced Past Incidents:
                          </span>
                          <ul className="mt-1 list-inside list-disc font-mono text-zinc-300">
                            {selectedCluster.ai_rca_cache.referenced_clusters.map((t, idx) => (
                              <li key={idx}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-400">
                      Clique em &quot;Run AI Analysis&quot; para consultar incidentes resolvidos no pgvector e gerar o diagnóstico.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR API KEY */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121721] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Create New API Key</h3>
              <button
                onClick={() => setShowNewKeyModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!createdProject ? (
              <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400">Project Name</label>
                  <input
                    type="text"
                    required
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder="ex: checkout-service"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#0b0e14] px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400">Environment</label>
                  <select
                    value={newProjEnv}
                    onChange={(e) => setNewProjEnv(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#0b0e14] px-3 py-2 text-sm text-white"
                  >
                    <option value="production">production</option>
                    <option value="staging">staging</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-sky-500 py-2 text-sm font-semibold text-zinc-950 hover:bg-sky-400"
                >
                  Generate Key
                </button>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-amber-300">
                  Copie sua chave agora. Por segurança, ela não será exibida novamente.
                </p>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#0b0e14] p-3 font-mono text-xs text-emerald-400">
                  <span className="truncate">{createdProject.api_key}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdProject.api_key);
                      setCopiedKey(true);
                    }}
                    className="ml-2 rounded bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
                  >
                    {copiedKey ? "Copied!" : "Copy"}
                  </button>
                </div>
                <button
                  onClick={() => setShowNewKeyModal(false)}
                  className="w-full rounded-lg bg-zinc-800 py-2 text-xs font-medium text-white hover:bg-zinc-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}