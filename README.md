# LeadFlow

> Multi-tenant mortgage-pipeline SaaS for brokerages serving expat home-buyers in Germany.

---

## Architecture Overview

```
leadflow/
├── client/       React + Vite + Tailwind + shadcn/ui (frontend)
├── server/       Node.js + Express + Mongoose + Socket.io (API)
├── worker/       BullMQ consumer (background jobs — document verification, emails)
└── types/        Shared TypeScript definitions (consumed by all packages)
```

**Infra dependencies** (local dev via Docker Compose, production via free tiers):
| Service | Local | Production |
|---|---|---|
| MongoDB | Docker (`mongo:7`) | MongoDB Atlas (free M0) |
| Redis | Docker (`redis:7.2`) | Upstash Redis (free tier) |
| File storage | AWS S3 / Cloudflare R2 | Same (free tier) |
| API + Worker | Local `ts-node-dev` | Render or Railway |
| Frontend | Local Vite dev server | Vercel |

---

## Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x
- **Docker + Docker Compose** (for local MongoDB & Redis)
- An **S3-compatible bucket** (AWS free tier or Cloudflare R2) for file uploads

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url> leadflow
cd leadflow
npm install          # installs all workspace packages
```

### 2. Environment variables

```bash
cp .env.example .env
# Edit .env — at minimum fill in:
#   MONGO_URI (or leave as-is for Docker)
#   REDIS_URL (or leave as-is for Docker)
#   JWT_SECRET (any long random string)
#   S3_* (your bucket credentials)
```

Copy the same `.env` into `server/` and `worker/` (both read from process.env):
```bash
cp .env server/.env
cp .env worker/.env
```

### 3. Start infrastructure

```bash
docker compose up -d        # starts MongoDB on :27017 and Redis on :6379
docker compose ps           # verify both are healthy
```

To also start the Redis Commander UI:
```bash
docker compose --profile debug up -d
# Open http://localhost:8081
```

### 4. Build shared types

```bash
npm run build --workspace=types
```

### 5. Run all services (development)

Open three terminals (or use the root `npm run dev` with `concurrently`):

```bash
# Terminal 1 — API server (port 4000)
npm run dev --workspace=server

# Terminal 2 — Background worker
npm run dev --workspace=worker

# Terminal 3 — Frontend (port 5173)
npm run dev --workspace=client
```

Or with one command from the root:
```bash
npm run dev
```

### 6. Seed the platform admin

```bash
npm run seed --workspace=server
# Creates the platform_admin account defined in .env
```

### 7. Verify the skeleton

| Check | Expected |
|---|---|
| `GET http://localhost:4000/health` | `{"status":"ok","service":"leadflow-api"}` |
| `GET http://localhost:4000/api` | `{"service":"LeadFlow API","version":"1.0.0","status":"ok"}` |
| `http://localhost:5173` | LeadFlow landing page with green API status |

---

## Phase Build Status

| Phase | Description | Status |
|---|---|---|
| 0 | Project scaffold | ✅ Done |
| 1 | Multi-tenant data model & auth | ✅ Done |
| 2 | Lead ingestion & pipeline board | ✅ Done |
| 3 | Real-time layer (Socket.io) | ✅ Done |
| 4 | Client conversion & portal | ✅ Done |
| 5 | Background document verification | ✅ Done |
| 6 | Dashboard with caching | ✅ Done |
| 7 | Email templates & automation | ✅ Done |
| 8 | Hardening & polish | ✅ Done |
| 9 | Deployment & deliverables | ✅ Done |

---

## Key Design Decisions

- **Monorepo with npm workspaces** — no Turborepo or Nx to keep the tooling surface minimal; `@leadflow/types` is a local package consumed by all services.
- **Separate worker process** — the BullMQ worker runs independently from the API so a slow document verification job cannot block HTTP responses.
- **Tenant isolation via Mongoose plugin** — a query middleware plugin auto-injects `brokerageId` on every query; missing it at the route layer won't leak data.
- **Optimistic concurrency with `version` field** — lead documents carry a monotonically incrementing `version`; updates only succeed if the submitted version matches the current one.
- **Docker Compose dev-only** — production uses managed services (Atlas, Upstash, Render) or containerized microservices.

---

## Demo Accounts & Evaluation Walkthrough

Run `npm run seed --workspace=server` to populate the database with demo accounts, sample leads, and stage automation.

| Role | Email | Password | Access / Capabilities |
|---|---|---|---|
| **Platform Admin** | `admin@leadflow.app` | `ChangeMe123!` | Create & manage brokerages, global system overview |
| **Brokerage Admin** | `admin@alpha-mortgage.demo` | `Demo1234!` | Full pipeline board, automation rules, team & templates |
| **Advisor** | `advisor@alpha-mortgage.demo` | `Demo1234!` | Assigned leads, task management, client conversions |

### Suggested Verification Flow:
1. **Pipeline Kanban**: Log in as `admin@alpha-mortgage.demo`. Drag leads across columns (New → Contacted → Qualified). Notice real-time badge updates and stage transitions.
2. **Stage Automations**: Navigate to **Automation** (`/automation`). Configure an auto-welcome email and automated follow-up tasks when a lead enters a stage.
3. **Lead Ingestion**: Send a POST to `/api/webhooks/leads/alpha-mortgage` to ingest leads externally with duplicate detection and HMAC signature support.
4. **Client Conversion & Document Portal**: In the Pipeline board, click "Convert to Client" on a qualified lead. Navigate to **Clients** (`/clients`) and upload test documents to see BullMQ asynchronous verification.
5. **Dashboard Analytics**: Check **Dashboard** (`/dashboard`) for conversion rate metrics, stage distribution graphs, and cached response headers.

---

## Production Deployment (Phase 9)

### 1. Database & Cache Setup (Free Tier)
- **MongoDB Atlas**:
  1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
  2. Whitelist `0.0.0.0/0` (or Render/worker outbound IPs) in Network Access.
  3. Create a database user and obtain your connection string: `mongodb+srv://<user>:<password>@cluster.mongodb.net/leadflow?retryWrites=true&w=majority`.
- **Upstash Redis**:
  1. Create a free serverless Redis database at [upstash.com](https://upstash.com).
  2. Copy the `rediss://...` connection URL.

### 2. API Server & Background Worker on Render
A production blueprint is pre-configured in [`render.yaml`](file:///d:/unsquare/render.yaml):
1. Push this repository to GitHub or GitLab.
2. Log in to [render.com](https://render.com) and click **New + → Blueprint**.
3. Select your repository. Render will automatically detect `render.yaml` and provision:
   - `leadflow-api` (Web Service on Node.js)
   - `leadflow-worker` (Background Worker on Node.js)
4. Set the environment variables in the Render Dashboard (`MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, `S3_*`).

### 3. Frontend SPA on Vercel
Pre-configured with [`client/vercel.json`](file:///d:/unsquare/client/vercel.json):
1. Import repository on [vercel.com](https://vercel.com).
2. Set **Root Directory** to `client`.
3. Set Environment Variables:
   - `VITE_API_URL`: `https://<your-render-api-domain>/api`
   - `VITE_SOCKET_URL`: `https://<your-render-api-domain>`
4. Deploy! All client routes (`/pipeline`, `/clients`, `/tasks`, etc.) are routed via SPA fallback.

### 4. Containerized Microservices (Docker)
Dedicated multi-stage production Dockerfiles are provided:
- **API Server**: `docker build -f Dockerfile.server -t leadflow-server .`
- **Worker**: `docker build -f Dockerfile.worker -t leadflow-worker .`

---

## Testing & Verification

```bash
# Type-check packages
npm run typecheck

# Integration tests
npm run test:isolation --workspace=server
```

