# 🛡️ LogSentinel — AI-Powered Observability & Semantic Error Tracking

**LogSentinel** é uma plataforma full-stack de observabilidade e rastreamento de erros em tempo real. Diferente de agregadores tradicionais baseados apenas em hash de texto, o LogSentinel utiliza **embeddings vetoriais (`all-MiniLM-L6-v2` + `pgvector`)** para agrupar falhas semanticamente semelhantes (mesmo com UUIDs, IPs ou IDs dinâmicos) e um **Agente de IA com RAG** que diagnostica a causa raiz consultando resoluções anteriores da própria equipe.

---

## 🏗️ Arquitetura do Sistema

```text
┌─────────────────┐     POST /api/v1/ingest      ┌─────────────────┐
│   Client App /  │ ───────────────────────────► │   FastAPI API   │
│  Traffic Sim.   │      (X-API-Key Auth)        │  (Validation)   │
└─────────────────┘                              └────────┬────────┘
                                                          │ LPUSH
                                                          ▼
┌─────────────────┐     GET /api/v1/clusters     ┌─────────────────┐
│   Next.js UI    │ ◄─────────────────────────── │   Redis Queue   │
│ (Tailwind + SVG)│                              └────────┬────────┘
└────────┬────────┘                                       │ BRPOP
         │                                                ▼
         │ POST /analyze                         ┌─────────────────┐
         │ (RAG + LLM)                           │   ML Worker     │
         ▼                                       │ (MiniLM-L6-v2)  │
┌─────────────────┐                              └────────┬────────┘
│  PostgreSQL 16  │ ◄─────────────────────────────────────┘
│   + pgvector    │     Cosine Similarity Search (< 0.25)
└─────────────────┘
```

---

## ✨ Principais Funcionalidades

- **Ingestão Assíncrona de Alta Vazão:** API FastAPI autenticada por `X-API-Key` (com hash SHA-256) enfileirando eventos no Redis sem bloquear a aplicação cliente.
- **Agrupamento Semântico (ML Clustering):** Worker dedicado que normaliza stack traces (removendo números de linha, hashes, UUIDs e IPs) e gera vetores de 384 dimensões para agrupar incidentes via distância de cosseno no `pgvector`.
- **Root Cause Analysis com RAG (Human-in-the-Loop):** Ao analisar um cluster, o motor busca os 3 incidentes resolvidos (`RESOLVED`) mais próximos vetorialmente e injeta suas notas de resolução no contexto do LLM para gerar diagnóstico, correção sugerida e score de confiança.
- **Dashboard Multi-View Enterprise:**
  - **Error Tracking:** KPIs com sparklines, tendência horária (24h), ranking de arquivos mais afetados e tabela de clusters.
  - **Live Tail:** Histograma de volume por hora e stream em tempo real dos logs ingeridos.
  - **Error Group Detail + AI Agent:** Inspeção de stack trace normalizado, diagnóstico por IA e registro de resolução com preenchimento assistido.
  - **API Keys & Projects:** Gestão multi-tenant de projetos e geração segura de chaves `ls_live_...`.

---

## 🛠️ Stack Tecnológica

- **Back-end:** Python 3.14, FastAPI, SQLAlchemy (Async), Pydantic v2, OpenAI SDK
- **Machine Learning & Vetores:** SentenceTransformers (`all-MiniLM-L6-v2`), PostgreSQL 16 + `pgvector`
- **Fila & Infraestrutura:** Redis 7, Docker & Docker Compose
- **Front-end:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons

---

## 📁 Estrutura do Projeto

```text
logsentinel/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Endpoints (ingest, clusters, projects)
│   │   ├── core/            # Configurações, segurança e hashing de API Keys
│   │   ├── db/              # Modelos SQLAlchemy + pgvector e sessão async
│   │   └── schemas/         # Contratos Pydantic v2
│   ├── worker.py            # Consumidor Redis + Normalização + Embeddings ML
│   ├── simulate_traffic.py  # Gerador de tráfego e falhas dinâmicas para testes
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/             # Dashboard multi-view (Next.js App Router)
│   │   ├── components/      # Gráficos SVG nativos (Sparklines, Area, Top Files)
│   │   └── lib/             # Cliente HTTP tipado para a API FastAPI
│   └── package.json
├── docker-compose.yml       # PostgreSQL (pgvector) + Redis
├── .gitignore
└── README.md
```

---

## 🚀 Como Executar Localmente

### 1. Subir Banco de Dados (`pgvector`) e Redis

```bash
docker compose up -d
```

### 2. Configurar e Iniciar o Back-end

```bash
cd backend
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env  # Adicione sua LLM_API_KEY no arquivo .env
```

Inicie a API e o Worker em dois terminais separados:

```bash
# Terminal 1 — API FastAPI
python -m uvicorn app.main:app --reload

# Terminal 2 — Worker de Embeddings & Clustering
python worker.py
```

### 3. Iniciar o Front-end

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
```

Acesse **`http://localhost:3000`** no navegador (e **`http://localhost:8000/docs`** para a documentação interativa Swagger da API).

---

## 🧪 Simulando Incidentes em Tempo Real

1. Na aba **API Keys** do dashboard, clique em **Create API Key**, crie um novo projeto e copie a chave gerada (`ls_live_...`).
2. Cole a chave na variável `API_KEY` dentro de `backend/simulate_traffic.py`.
3. Ative o modo **Live (5s)** no topo do dashboard e execute:

```bash
cd backend
python simulate_traffic.py
```

4. Observe os logs chegando no **Live Tail**, sendo agrupados automaticamente por similaridade semântica na aba **Error Tracking** e clique em qualquer cluster para executar a **Análise de Causa Raiz (AI Agent)**.
