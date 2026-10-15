# Workflow: Generate a plan from a spec

**Input:** `.ai-context/specs/<slug>.spec.md` in `Ready` state.
**Output:** `.ai-context/plans/<slug>.plan.md` and `.ai-context/tasks/<slug>.tasks.md`.

1. Read the spec, the BRD entry it links, and only the `architecture.md` sections it names.
2. Look up every shared fact the spec uses in `ownership_index.md`; link to it, never restate it.
3. Write **Architecture Approach**: modules touched, new vs existing classes, the interfaces
   crossing each boundary, and which approved pattern (`constitution.md`) each seam uses.
4. Write **Data Model**: collections, fields, indexes, seed data. One writing module per
   collection.
5. Tick the **Constitution Check** honestly. A box that cannot be ticked stops the plan — raise
   it instead of working around it.
6. Write **Explicitly Deferred** with a reason per item.
7. Derive tasks: each task is independently verifiable, names its AC IDs, and is small enough to
   review as one diff. Backend order is always contracts → repository → service → controller +
   routes → container wiring → OpenAPI. Frontend order is renderer → editor → wiring.
8. If the plan adds a module dependency edge or a collection, update `architecture.md` in the
   same change.
