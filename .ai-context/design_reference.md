# Design Reference — what the attached HTML contains

**Source:** `Ghulam Portfolio.html` (attached 2026-10-11). Canonical owner of the reference
content and visual tokens. Specs link here; they do not restate this content.

## What the file actually is
The HTML is a bundled export with **two flat JPEG boards and no DOM**:
| Board | Size | Extracted to |
|---|---|---|
| Desktop — 1440 | 1440 × 6751 px | `docs/design-reference/desktop-1440.jpg` |
| Mobile — 390 | 390 × 10711 px | `docs/design-reference/mobile-390.jpg` |

Everything below was read from those images. Text is transcribed as shown. Anything an image
cannot carry is listed under **Unknowns** and must not be guessed.

## Page structure (top to bottom)
| # | Block | Section type | Eyebrow | Nav label |
|---|---|---|---|---|
| — | Floating nav pill | (shell) | — | — |
| — | Hero + tech marquee | `hero` | — | — |
| 01 | About | `about` | `01 — ABOUT` | About |
| 02 | Selected work | `work` | `02 — SELECTED WORK` | Work |
| 03 | Experience | `experience` | `03 — EXPERIENCE` | Experience |
| 04 | Stack, education, certifications | `stack` | `04 — STACK` | Stack |
| 05 | Contact | `contact` | `05 — CONTACT` | Contact |
| — | Footer | (shell) | — | — |

Every section heading is a plain lead followed by an italic-serif emphasis (shown below as
*italic*). The emphasis is lime in the hero and contact headings and muted grey elsewhere.

## Nav
- Desktop: lime circular monogram `GF` · About · Work · Experience · Stack · **Contact** (filled
  pill) · **Résumé** (outlined pill).
- Mobile: monogram `GF` and `Résumé` only — section links are not shown.

## Hero
- Availability badge (lime dot): `Open to Full Stack & Gen AI roles`
- Heading: `I build AI-powered products that` *ship in days.*
- Intro: `Hi, I'm` **S M Ghulam Ghaus Faiyaz** `— a full stack developer and gen ai engineer
  building RAG pipelines, LLM integrations and the scalable backends underneath them.`
- Primary button `See my work ↘` (lime) · secondary button `Get in touch ↗` (outline) · GitHub
  and LinkedIn icon links
- Code card, title bar `ghulam.config.ts`, body `export const me = { … }`:
  | Key | Value |
  |---|---|
  | `role` | `"Full Stack Developer · Gen AI Engineer"` |
  | `experience` | `"2+ years"` |
  | `based` | `"Kolkata, India"` |
  | `stack` | `["TypeScript", "NestJS", "Next.js", "Postgres"…` — clipped on both boards |
  | `ai` | `["RAG", "GPT-4", "Claude", "Gemini"]` |
  | `workflow` | `"spec → agent → review → log"` |
  Footer row with a pin icon: `Kolkata, India · IST (UTC+5:30)`
- Marquee strip (mono, lime dot separators), visible items in order: PostgreSQL · Prisma · Redis
  · BullMQ · MongoDB · RAG · GPT-4 · Claude · Gemini · FastAPI. Both edges fade, so the full list
  may be longer.
- Mobile: single column — text, buttons, icons, then the code card, then the marquee.

## 01 About
- Heading: `Production backends,` *with AI built in.*
- Bio card: `Full Stack Developer with 2+ years of experience building AI-powered,
  production-grade applications. I design RAG pipelines, wire LLMs (Claude, OpenAI, Gemini) into
  real products, and use structured AI-assisted development to ship in days instead of weeks — on
  backends built with OOP and SOLID principles.`
- "Currently" card (sparkle icon): label `CURRENTLY`, text `Associate Software Engineer at Indus
  Net Technologies`
- Stat cards (2 × 2 on desktop, stacked on mobile):
  | Value | Label |
  |---|---|
  | `2+` | Years shipping production software |
  | `50+` | REST endpoints shipped on one platform |
  | `80%` | Query depth cut in a Firebase → MongoDB migration |
  | `3 days` | Admin panel + seed data, from a multi-week plan |
- Process card: eyebrow `HOW I WORK`; title `AI-assisted, but never vibe-coded.`; side note
  `Structured with AIPOS and Claude Code — zero spec drift across 10+ shipped modules.`; four
  numbered steps (a row on desktop, a column on mobile):
  | # | Title | Description |
  |---|---|---|
  | 01 | Spec before code | Every task starts as a spec block in a living domain doc. |
  | 02 | Agent builds | Claude Code implements against the spec, not a vague prompt. |
  | 03 | Gated review | Nothing merges without a review gate and a clean TS/ESLint build. |
  | 04 | Decision log | Append-only logs keep every change traceable across 30+ docs. |

## 02 Selected work
- Heading: `Systems that run` *real businesses.*
- **Featured card** (full width; badge `Featured`):
  - Category `Multi-portal healthcare procurement platform` · title `Medeeze / VMD`
  - Description: `Backend for a Customer / Sales Rep / Admin B2B platform, synced live with SAP
    ERP and CRM through a 4-tier (T0–T3) hybrid data architecture. Passwordless OTP login for
    customers and reps, 2FA for admins, and BullMQ workers feeding a real-time KPI dashboard.`
  - Tags: Node.js · Express · TypeScript · Prisma · PostgreSQL · Redis · BullMQ
  - Metric grid 2 × 2: `50+` REST endpoints · `100%` OpenAPI coverage · `36→29` Postgres tables ·
    `12` real-time KPIs
- **Three cards** (a row on desktop, stacked on mobile):
  | Title | Category | Description | Metrics | Tags |
  |---|---|---|---|---|
  | Sovihealth | AI health risk assessment | A GPT-4 RAG system delivering personalised health insights from structured questionnaires, plus a Firebase → MongoDB migration and Stripe subscription billing with proration and payment recovery. | `80%` less query depth · `GPT-4` RAG pipeline | NestJS · MongoDB · OpenAI · Stripe · Cron |
  | OutThereMedia | Multi-tenant SaaS platform | A 4-tier Stripe billing engine with webhook-driven state sync, async usage-vs-limit analytics across 6+ resource types, and multi-tenant workspaces with RBAC. | `100%` lifecycles automated · `0%` entitlement leakage | Node.js · Stripe · RBAC · Webhooks |
  | Second Brain | Personal product | My own app, live at app.second-brain.live. `[ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]` | none | Next.js · TypeScript · LLM APIs |
  Second Brain is the only card with an external-link arrow button (top right).
- **The Second Brain description still contains an unfilled placeholder.** It is carried into
  seed data unchanged, and `publish-pipeline.AC4` blocks publishing until it is replaced.

## 03 Experience
- Heading: `Where I've` *shipped.*
- Vertical timeline. Desktop: date and city right-aligned in a left column, a dot on the line,
  then company, role and bullets. Mobile: dot, date and city above the company. The current role
  has a glowing lime dot; past roles a grey dot.
- Entry 1 — `Sept 2024 — Present` · Kolkata · **Indus Net Technologies** · Associate Software
  Engineer
  - Backend for Medeeze / VMD, a 3-persona B2B healthcare procurement platform integrated live
    with SAP ERP and CRM.
  - Sovihealth: designed a GPT-4 RAG system turning questionnaire data into personalised health
    insights.
  - OutThereMedia: built a 4-tier Stripe billing engine and multi-tenant workspaces with RBAC.
  - Ran AI-assisted development with AIPOS + Claude Code: spec-before-code, gated reviews, zero
    spec drift.
- Entry 2 — `Jan 2024 — Sept 2024` · Kolkata · **DCG Data Core System** · Project Associate
  - Built React UI modules for an EdTech platform: course listing, authentication and progress
    tracking.
  - Created 8+ reusable, responsive components shared across 3+ feature modules.

## 04 Stack
- Heading: `The tools` *I reach for.*
- Six chip groups (3 × 2 on desktop, stacked on mobile):
  | Group | Items |
  |---|---|
  | Languages | JavaScript · TypeScript · Python |
  | Backend | Node.js · Express.js · NestJS · FastAPI · REST APIs |
  | Frontend | React.js · Next.js · Zustand · TanStack Query · Framer Motion |
  | Databases | PostgreSQL · MongoDB · Redis · Prisma · TypeORM · Mongoose |
  | Generative AI | RAG Pipelines · Prompt Engineering · GPT-4 · Claude · Gemini · Embeddings · Vector Search |
  | Cloud / DevOps | AWS S3 · AWS EC2 · Docker · Git · Postman |
- Education & training card (cap icon):
  | Title | Institution | Years | Detail |
  |---|---|---|---|
  | PGPM | IBS, Kolkata | 2019 – 2021 | CGPA 7.79 |
  | B.Tech | Ideal Institute of Engineering, MAKAUT | 2012 – 2016 | CGPA 7.72 |
  | Full Stack Web Development | Coding Ninjas | 2023 – 2024 | Backend · Frontend · Python · DSA |
- Certifications card (ribbon icon): `Claude 101` — Anthropic · `Claude Code 101` — Anthropic

## 05 Contact
- A single rounded card with a dot grid and a lime glow rising from the bottom edge.
- Eyebrow `05 — CONTACT`; heading `Have something to build?` *Let's talk.*
- Body: `Open to full stack and Gen AI engineering roles, and interesting freelance work.`
- Primary button `Email me ↗` · copy-email chip showing `smghulam.ghausfaiyaz19@gmail.com`
  (truncated with an ellipsis on mobile) · text links `LinkedIn`, `GitHub`
- **There is no contact form** on either board.

## Footer
- Left: `© 2026 S M Ghulam Ghaus Faiyaz` · right: `Built with Next.js · Tailwind · Motion`
  (centred and stacked on mobile).

## Visual tokens (sampled from the desktop JPEG — approximate)
| Token | Sampled | Notes |
|---|---|---|
| Page background | `#09090b` | exact at flat areas |
| Card surface | `#0e0e10` – `#111113` | about, work and contact cards |
| Raised surface | `#151517` | code card, metric panel |
| Primary text | `#ededef` | headings and body |
| Accent (lime) | ≈ `#c0f83c` | JPEG compression spreads this between `#bffc3f` and `#c8f848` |
| Text on accent | near-black | primary button label |
Other observable traits: large card radius (about 20–24 px), pill buttons and nav, hairline
borders slightly lighter than the surface, a dot-grid texture and soft lime radial glow behind
the hero and inside the contact card, mono eyebrows with wide letter-spacing.

## Unknowns — not recoverable from flat images
1. **Font families.** Three roles are visible — a grotesk sans, an italic display serif, a
   monospace — but the files are not named anywhere in the export.
2. **Exact colour values** for accent, borders and muted text (JPEG artefacts).
3. **All interaction and motion:** hover and focus states, marquee direction and speed, scroll
   reveals, nav behaviour on scroll, the active-link rule (why `Contact` is the filled pill).
4. **Mobile navigation** to sections — the mobile board shows no menu.
5. **Link targets:** GitHub, LinkedIn, the Second Brain arrow and the Résumé file are not
   encoded in an image. Values come from the résumé PDF: `github.com/SMGhulam29091993`,
   `linkedin.com/in/s-m-ghulam-ghaus-faiyaz`, `app.second-brain.live`.
6. **The full marquee list** and the full `stack` array in the code card (both clipped).
7. **Behaviour between 390 and 1440** — only the two widths were designed.

Each unknown is carried as an Open Question in the spec that needs it.
