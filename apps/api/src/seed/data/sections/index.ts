/**
 * The owner's reference content, one entry per section type, transcribed from
 * `design_reference.md` by each section's spec (`section-engine` plan → Data Model). Seed data
 * for the development account only: every other user starts from the template's placeholders.
 *
 * Every list item carries a fixed `id`, so a re-seed and an edit can never disagree about
 * which item is which.
 */
import { REFERENCE_ABOUT } from './about.js';
import { REFERENCE_CONTACT } from './contact.js';
import { REFERENCE_EXPERIENCE } from './experience.js';
import { REFERENCE_HERO } from './hero.js';
import { REFERENCE_STACK } from './stack.js';
import { REFERENCE_WORK } from './work.js';

export const REFERENCE_SECTIONS: Readonly<Record<string, unknown>> = Object.freeze({
  hero: REFERENCE_HERO,
  about: REFERENCE_ABOUT,
  work: REFERENCE_WORK,
  experience: REFERENCE_EXPERIENCE,
  stack: REFERENCE_STACK,
  contact: REFERENCE_CONTACT,
});
