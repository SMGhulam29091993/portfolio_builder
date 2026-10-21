/**
 * The development account's identity: the reference values from `design_reference.md` (Nav,
 * Hero, Contact, Footer) and the link targets the owner confirmed on 2026-10-20
 * (`site-identity.OQ1`, `OQ2`). Seed data for the development account only — every other user
 * starts from the template (`site-identity.AC11`). The résumé is uploaded through the CMS, so
 * `assetId` starts `null`.
 */
export const REFERENCE_IDENTITY = Object.freeze({
  fullName: 'S M Ghulam Ghaus Faiyaz',
  monogram: 'GF',
  roleTitle: 'Full Stack Developer · Gen AI Engineer',
  email: 'smghulam.ghausfaiyaz19@gmail.com',
  location: { label: 'Kolkata, India', timezoneLabel: 'IST (UTC+5:30)' },
  availability: { enabled: true, label: 'Open to Full Stack & Gen AI roles' },
  socials: [
    { id: 'social-github', platform: 'github', url: 'https://github.com/SMGhulam29091993' },
    { id: 'social-linkedin', platform: 'linkedin', url: 'https://linkedin.com/in/s-m-ghulam-ghaus-faiyaz' },
  ],
  resume: { assetId: null, label: 'Résumé' },
  footer: { copyrightName: 'S M Ghulam Ghaus Faiyaz', builtWith: ['Next.js', 'Tailwind', 'Motion'] },
  seo: {
    title: 'S M Ghulam Ghaus Faiyaz — Full Stack Developer · Gen AI Engineer',
    description:
      'A full stack developer and gen ai engineer building RAG pipelines, LLM integrations and the scalable backends underneath them.',
    ogImageAssetId: null,
  },
});
