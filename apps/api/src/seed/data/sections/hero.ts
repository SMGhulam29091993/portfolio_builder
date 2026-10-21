/**
 * The owner's hero (`hero-section.AC1`; `design_reference.md` → Hero; the clipped `stack` array
 * and marquee completed by the owner on 2026-10-20). Development seed data only.
 */
export const REFERENCE_HERO = {
  heading: { lead: 'I build AI-powered products that', emphasis: 'ship in days.' },
  intro: {
    prefix: "Hi, I'm",
    showName: true,
    body: 'a full stack developer and gen ai engineer building RAG pipelines, LLM integrations and the scalable backends underneath them.',
  },
  primaryCta: { label: 'See my work', target: { kind: 'section', sectionType: 'work' } },
  secondaryCta: { label: 'Get in touch', target: { kind: 'section', sectionType: 'contact' } },
  showAvailability: true,
  showSocialIcons: true,
  codeCard: {
    enabled: true,
    filename: 'ghulam.config.ts',
    exportName: 'me',
    showLocation: true,
    entries: [
      { id: 'hero-role', key: 'role', value: 'Full Stack Developer · Gen AI Engineer' },
      { id: 'hero-experience', key: 'experience', value: '2+ years' },
      { id: 'hero-based', key: 'based', value: 'Kolkata, India' },
      { id: 'hero-stack', key: 'stack', value: ['TypeScript', 'NestJS', 'Next.js', 'Postgres', 'MongoDB', 'Redis'] },
      { id: 'hero-ai', key: 'ai', value: ['RAG', 'GPT-4', 'Claude', 'Gemini'] },
      { id: 'hero-workflow', key: 'workflow', value: 'spec → agent → review → log' },
    ],
  },
  marquee: {
    enabled: true,
    items: ['TypeScript', 'Node.js', 'NestJS', 'Next.js', 'PostgreSQL', 'Prisma', 'Redis', 'BullMQ', 'MongoDB', 'RAG', 'GPT-4', 'Claude', 'Gemini', 'FastAPI', 'Docker', 'AWS'],
  },
};
