# PROMPTS.md — AI Prompt Log & Development History

> **Mandatory Deliverable.** Complete chronological log of prompts issued during the LeadFlow platform build, including architectural phase prompts, code generation requests, and iterative debugging logs.

---

## 1. Master Build & Architecture Prompts (Phase 0–8)

### Prompt 1 — Project Scaffolding & Monorepo Setup (Phase 0)
**Tool / Model:** Antigravity (Google DeepMind)  
**Date:** 2026-09-25  

```markdown
Build a multi-tenant mortgage-pipeline SaaS platform ("LeadFlow") for German mortgage brokerages using Node.js, Express, TypeScript, MongoDB (Mongoose), Redis (Upstash / BullMQ), React (Vite, Tailwind, Lucide-react), and Socket.io.
Implement a clean monorepo architecture with npm workspaces:
- @leadflow/types (shared DTOs, interfaces, and schemas)
- server (Express API, Socket.io server, Mongoose models)
- worker (BullMQ consumer for async document verification and email triggers)
- client (React SPA frontend with Tailwind UI)
```

---

### Prompt 2 — Multi-Tenant Data Model & Auth (Phase 1)
**Tool / Model:** Antigravity (Google DeepMind)  

```markdown
Implement multi-tenant data isolation using a custom Mongoose query middleware plugin (`tenantScopePlugin`).
Requirements:
1. Every query on `Lead`, `Client`, `Document`, and `EmailTemplate` must automatically enforce `brokerageId` filtering.
2. Implement JWT authentication with role-based access control (`platform_admin`, `brokerage_admin`, `advisor`, `client`).
3. Add secure password hashing with bcrypt, timing-attack protection on login, and JWT middleware.
```

---

### Prompt 3 — Lead Ingestion & Pipeline Kanban Board (Phase 2 & 3)
**Tool / Model:** Antigravity (Google DeepMind)  

```markdown
Build a real-time Lead Pipeline Kanban board for advisors and admins:
1. Support drag-and-drop lead stage transitions (New -> Contacted -> Qualified -> Proposal -> Won/Lost).
2. Implement optimistic concurrency control using a version field on Lead models.
3. Socket.io real-time layer: broadcast `lead:created`, `lead:updated`, and `lead:stage_changed` to brokerage-specific rooms (`brokerage:<id>`).
4. External lead ingestion webhook (`POST /api/webhooks/leads/:brokerageSlug`) with HMAC signature verification and duplicate detection by email/phone.
```

---

### Prompt 4 — Client Portal & Asynchronous Document Verification (Phase 4 & 5)
**Tool / Model:** Antigravity (Google DeepMind)  

```markdown
Create a client self-service portal (`/portal`) and background verification system:
1. Convert Qualified leads into active Clients with generated portal login credentials.
2. Allow clients to upload mortgage documents (PDF, PNG, JPG) with per-file progress tracking.
3. Asynchronous BullMQ background worker (`document-verification` queue): simulate OCR and anti-fraud checks (checksum, stamp analysis) with random processing delay (2.5s–4.5s).
4. Emit `doc:status` real-time socket notifications to both the client portal and advisor dashboard upon verification completion.
```

---

### Prompt 5 — Production-Grade Email Dispatcher & Multi-Provider Failover (Phase 7)
**Tool / Model:** Antigravity (Google DeepMind)  

```markdown
Design an enterprise production email delivery service (`ProductionEmailService`) with multi-provider failover:
1. Strategy 1 (Primary): Resend HTTPS REST API (`https://api.resend.com/emails`) over Port 443 with default sender `onboarding@resend.dev`.
2. Strategy 2 (Secondary): Brevo HTTPS REST API (`https://api.brevo.com/v3/smtp/email`) over Port 443 with sanitized API key authentication.
3. Strategy 3 (Fallback): Nodemailer SMTP over Port 465 SSL (`smtp-relay.brevo.com`).
4. Automatic environment variable cleaning (`cleanEnv`) to strip accidental quotes and whitespace.
```

---

## 2. Iterative Debugging & Conversation Log (Raw Prompts)

### Prompt 6 — Free Email Sending Guidance
**User:** `again tell the steps for free email sending`  
**Goal:** Review free tier email options (Brevo 300/day, Resend 3k/month, Gmail SMTP, Mailtrap) and set up `.env` parameters for the background worker.

---

### Prompt 7 — Brevo Dashboard Verification
**User:** `??` *(Attached screenshot of Brevo SMTP settings showing SMTP host, port 587, login, and masked SMTP key)*  
**Goal:** Map Brevo dashboard credentials (`smtp-relay.brevo.com`, port 587, login `9e13b900...`) into the project's `.env` configuration.

---

### Prompt 8 — Render ETIMEDOUT Connection Error Diagnosis
**User:** `[worker:email] Failed to send email to nanolive73@gmail.com: Error: Connection timeout code: 'ETIMEDOUT', command: 'CONN' ??`  
**Goal:** Diagnose cloud host port restrictions on Render (Port 587 STARTTLS timeout) and switch to Port 465 SSL or HTTPS REST API (Port 443).

---

### Prompt 9 — Permanent Solution Request
**User:** `but do you actually think that 465 will solve this issue permanantly??`  
**Goal:** Explain the limitations of raw TCP SMTP on cloud environments and implement an HTTPS REST API sender over Port 443.

---

### Prompt 10 — Environment Variable Validation
**User:**
```env
SMTP_ENABLED=true
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=465
SMTP_USER=9e13b9001@smtp-brevo.com
SMTP_PASS=xsmtpsib-REDACTED_BREVO_SMTP_KEY_PLACEHOLDER
SMTP_FROM=ninjagaming1607@gmail.com

is this correct? and tell the steps to actually permanantly solve the issue of timeout and change the code if required
```  
**Goal:** Confirm exact credentials mapping and refactor `email.processor.ts` to support HTTPS API sending.

---

### Prompt 11 — Brevo API Key vs SMTP Key Discrepancy
**User:** `[worker:email] Brevo HTTPS API returned HTTP 401: {"message":"Key not found","code":"unauthorized"}`  
**Goal:** Resolve difference between Brevo SMTP keys (`xsmtpsib-...`) and Brevo API keys (`xkeysib-...`), updating `email.processor.ts` to route keys to their respective transport.

---

### Prompt 12 — Resend Integration & Switching
**User:** `and tell the steps after receiving the resend api keyt remove brevo completely`  
**Goal:** Provide steps to switch to Resend API (`re_...`), update `ProductionEmailService` to handle `onboarding@resend.dev` sandbox sender, and strip unused Brevo env vars.

---

### Prompt 13 — Brevo IP Restriction Error
**User:** `[EmailService] Brevo HTTPS API HTTP 401: {"message":"We have detected you are using an unrecognised IP address 74.220.48.202..."}`  
**Goal:** Identify active IP restriction setting on Brevo security panel and guide user to disable IP blocking for dynamic cloud hosts like Render.

---

### Prompt 14 — Authentication UI Polish & Credentials Listing
**User:** `remove this and just give the real username and password for every role` *(Attached screenshot of login page demo accounts box)*  
**Goal:** Remove demo accounts card from `LoginPage.tsx` UI and document exact credentials for Platform Admin, Brokerage Admin, Advisor, and Client roles.

---

### Prompt 15 — Client Login Redirect Loop Fix
**User:** `why client login is not working?? after entering the password it is refreshing and coming to login only`  
**Goal:** Fix Axios 401 response interceptor in `api.ts` to exempt `/auth/login` from window location refresh, and fix tenant scope `Client.findOne` query in `create-demo-users.ts` seeder.
