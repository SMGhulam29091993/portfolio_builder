/** The owner's about section (`about-section.AC1`; `design_reference.md` → 01 About). */
export const REFERENCE_ABOUT = {
  meta: { eyebrow: 'About', navLabel: 'About', showInNav: true },
  heading: { lead: 'Production backends,', emphasis: 'with AI built in.' },
  bio: 'Full Stack Developer with 2+ years of experience building AI-powered, production-grade applications. I design RAG pipelines, wire LLMs (Claude, OpenAI, Gemini) into real products, and use structured AI-assisted development to ship in days instead of weeks — on backends built with OOP and SOLID principles.',
  currently: { enabled: true, label: 'Currently', text: 'Associate Software Engineer at Indus Net Technologies' },
  stats: [
    { id: 'stat-years', value: '2+', label: 'Years shipping production software' },
    { id: 'stat-endpoints', value: '50+', label: 'REST endpoints shipped on one platform' },
    { id: 'stat-query', value: '80%', label: 'Query depth cut in a Firebase → MongoDB migration' },
    { id: 'stat-admin', value: '3 days', label: 'Admin panel + seed data, from a multi-week plan' },
  ],
  process: {
    enabled: true,
    eyebrow: 'How I work',
    title: 'AI-assisted, but never vibe-coded.',
    note: 'Structured with AIPOS and Claude Code — zero spec drift across 10+ shipped modules.',
    steps: [
      { id: 'step-spec', title: 'Spec before code', description: 'Every task starts as a spec block in a living domain doc.' },
      { id: 'step-agent', title: 'Agent builds', description: 'Claude Code implements against the spec, not a vague prompt.' },
      { id: 'step-review', title: 'Gated review', description: 'Nothing merges without a review gate and a clean TS/ESLint build.' },
      { id: 'step-log', title: 'Decision log', description: 'Append-only logs keep every change traceable across 30+ docs.' },
    ],
  },
};
