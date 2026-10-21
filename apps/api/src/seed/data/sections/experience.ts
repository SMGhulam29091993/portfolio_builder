/** The owner's experience (`experience-timeline.AC1`; `design_reference.md` → 03 Experience). */
export const REFERENCE_EXPERIENCE = {
  meta: { eyebrow: 'Experience', navLabel: 'Experience', showInNav: true },
  heading: { lead: "Where I've", emphasis: 'shipped.' },
  presentLabel: 'Present',
  entries: [
    {
      id: 'role-indus',
      company: 'Indus Net Technologies',
      role: 'Associate Software Engineer',
      location: 'Kolkata',
      start: { year: 2024, month: 9 },
      end: null,
      highlights: [
        'Backend for Medeeze / VMD, a 3-persona B2B healthcare procurement platform integrated live with SAP ERP and CRM.',
        'Sovihealth: designed a GPT-4 RAG system turning questionnaire data into personalised health insights.',
        'OutThereMedia: built a 4-tier Stripe billing engine and multi-tenant workspaces with RBAC.',
        'Ran AI-assisted development with AIPOS + Claude Code: spec-before-code, gated reviews, zero spec drift.',
      ],
    },
    {
      id: 'role-dcg',
      company: 'DCG Data Core System',
      role: 'Project Associate',
      location: 'Kolkata',
      start: { year: 2024, month: 1 },
      end: { year: 2024, month: 9 },
      highlights: [
        'Built React UI modules for an EdTech platform: course listing, authentication and progress tracking.',
        'Created 8+ reusable, responsive components shared across 3+ feature modules.',
      ],
    },
  ],
};
