/**
 * The owner's work section (`work-showcase.AC1`; `design_reference.md` → 02 Selected work). The
 * Second Brain description keeps its placeholder exactly as shown: the owner fills it in from the
 * CMS, and publishing is blocked until then (`publish-pipeline.AC4`).
 */
export const REFERENCE_WORK = {
  meta: { eyebrow: 'Selected work', navLabel: 'Work', showInNav: true },
  heading: { lead: 'Systems that run', emphasis: 'real businesses.' },
  featuredBadge: 'Featured',
  projects: [
    {
      id: 'project-medeeze',
      title: 'Medeeze / VMD',
      category: 'Multi-portal healthcare procurement platform',
      description:
        'Backend for a Customer / Sales Rep / Admin B2B platform, synced live with SAP ERP and CRM through a 4-tier (T0–T3) hybrid data architecture. Passwordless OTP login for customers and reps, 2FA for admins, and BullMQ workers feeding a real-time KPI dashboard.',
      featured: true,
      metrics: [
        { id: 'medeeze-endpoints', value: '50+', label: 'REST endpoints' },
        { id: 'medeeze-openapi', value: '100%', label: 'OpenAPI coverage' },
        { id: 'medeeze-tables', value: '36→29', label: 'Postgres tables' },
        { id: 'medeeze-kpis', value: '12', label: 'real-time KPIs' },
      ],
      tags: ['Node.js', 'Express', 'TypeScript', 'Prisma', 'PostgreSQL', 'Redis', 'BullMQ'],
      link: null,
    },
    {
      id: 'project-sovihealth',
      title: 'Sovihealth',
      category: 'AI health risk assessment',
      description:
        'A GPT-4 RAG system delivering personalised health insights from structured questionnaires, plus a Firebase → MongoDB migration and Stripe subscription billing with proration and payment recovery.',
      featured: false,
      metrics: [
        { id: 'sovihealth-query', value: '80%', label: 'less query depth' },
        { id: 'sovihealth-rag', value: 'GPT-4', label: 'RAG pipeline' },
      ],
      tags: ['NestJS', 'MongoDB', 'OpenAI', 'Stripe', 'Cron'],
      link: null,
    },
    {
      id: 'project-outtheremedia',
      title: 'OutThereMedia',
      category: 'Multi-tenant SaaS platform',
      description:
        'A 4-tier Stripe billing engine with webhook-driven state sync, async usage-vs-limit analytics across 6+ resource types, and multi-tenant workspaces with RBAC.',
      featured: false,
      metrics: [
        { id: 'otm-lifecycles', value: '100%', label: 'lifecycles automated' },
        { id: 'otm-leakage', value: '0%', label: 'entitlement leakage' },
      ],
      tags: ['Node.js', 'Stripe', 'RBAC', 'Webhooks'],
      link: null,
    },
    {
      id: 'project-second-brain',
      title: 'Second Brain',
      category: 'Personal product',
      description: 'My own app, live at app.second-brain.live. [ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]',
      featured: false,
      metrics: [],
      tags: ['Next.js', 'TypeScript', 'LLM APIs'],
      link: 'https://app.second-brain.live',
    },
  ],
};
