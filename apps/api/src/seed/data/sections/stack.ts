/** The owner's stack and credentials (`stack-credentials.AC1`; `design_reference.md` → 04 Stack). */
export const REFERENCE_STACK = {
  meta: { eyebrow: 'Stack', navLabel: 'Stack', showInNav: true },
  heading: { lead: 'The tools', emphasis: 'I reach for.' },
  groups: [
    { id: 'group-languages', label: 'Languages', items: ['JavaScript', 'TypeScript', 'Python'] },
    { id: 'group-backend', label: 'Backend', items: ['Node.js', 'Express.js', 'NestJS', 'FastAPI', 'REST APIs'] },
    { id: 'group-frontend', label: 'Frontend', items: ['React.js', 'Next.js', 'Zustand', 'TanStack Query', 'Framer Motion'] },
    { id: 'group-databases', label: 'Databases', items: ['PostgreSQL', 'MongoDB', 'Redis', 'Prisma', 'TypeORM', 'Mongoose'] },
    { id: 'group-genai', label: 'Generative AI', items: ['RAG Pipelines', 'Prompt Engineering', 'GPT-4', 'Claude', 'Gemini', 'Embeddings', 'Vector Search'] },
    { id: 'group-cloud', label: 'Cloud / DevOps', items: ['AWS S3', 'AWS EC2', 'Docker', 'Git', 'Postman'] },
  ],
  education: {
    enabled: true,
    label: 'Education & training',
    entries: [
      { id: 'edu-pgpm', title: 'PGPM', institution: 'IBS, Kolkata', startYear: 2019, endYear: 2021, detail: 'CGPA 7.79' },
      { id: 'edu-btech', title: 'B.Tech', institution: 'Ideal Institute of Engineering, MAKAUT', startYear: 2012, endYear: 2016, detail: 'CGPA 7.72' },
      { id: 'edu-coding-ninjas', title: 'Full Stack Web Development', institution: 'Coding Ninjas', startYear: 2023, endYear: 2024, detail: 'Backend · Frontend · Python · DSA' },
    ],
  },
  certifications: {
    enabled: true,
    label: 'Certifications',
    entries: [
      { id: 'cert-claude-101', name: 'Claude 101', issuer: 'Anthropic', url: null },
      { id: 'cert-claude-code-101', name: 'Claude Code 101', issuer: 'Anthropic', url: null },
    ],
  },
};
