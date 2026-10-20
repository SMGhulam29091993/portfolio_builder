/**
 * The owner's reference content, one entry per section type, transcribed from
 * `design_reference.md` by each section's spec (`section-engine` plan → Data Model). Seed data
 * for the development account only: every other user starts from the template's placeholders.
 *
 * Every list item carries a fixed `id`, so a re-seed and an edit can never disagree about
 * which item is which. A type with no entry here starts from its template defaults.
 */
export const REFERENCE_SECTIONS: Readonly<Record<string, unknown>> = Object.freeze({});
