# Workflow: Self-review checklist (run before any task is marked `completed`)

There is no second reviewer on this project (ADR-0001). Run every item against the diff; an
unticked item means the task stays `inprogress`.

## Scope
- [ ] The diff implements the named task and ACs — nothing from another task or from the plan's
      `Explicitly Deferred` list.

## SOLID and module boundaries (`constitution.md`)
- [ ] Each new class has one responsibility and sits in the correct layer.
- [ ] No concrete class imports another concrete class; only interfaces cross boundaries.
- [ ] No `new` of a service, repository, adapter or controller outside `container.ts` / tests.
- [ ] Cross-module imports go through `modules/<name>/index.ts` only.
- [ ] A new variant (section, provider, rule, storage) was added, not edited into the engine.
- [ ] Every new implementation of an existing interface is added to that interface's contract
      suite.
- [ ] No module dependency edge or collection writer was added without updating
      `architecture.md` — and, for an edge, `apps/api/src/architecture/module-dependency-map.ts`
      in the same change (the architecture test enforces the table, not the prose).

## Security
- [ ] No hardcoded business payload; no secret, model ID or URL literal.
- [ ] No secret, token, cookie, prompt text or email address is logged.
- [ ] Inputs validated through `validate(schema)`; free text through `plainText`.
- [ ] Any new integration has the dev-bypass guard and a test in both directions.
- [ ] Nothing under `/api/v1/public` can reach draft data.

## Contract and tests
- [ ] Responses use the standard envelope and the canonical error codes.
- [ ] OpenAPI document updated in this change.
- [ ] Each AC touched has a test named with its ID; test-first scope respected.
- [ ] Integration tests hit real MongoDB, not a mocked model.

## Frontend (when `apps/web` or `packages/sections` changed)
- [ ] No hex or font literal in a component; strings come from props.
- [ ] Keyboard reachable, visible focus, labelled controls, axe clean.
- [ ] Reduced motion respected; layout holds at 390, 768, 1024, 1440.

## Records
- [ ] State files, spec status and `status.md` updated.
- [ ] New shared fact registered in `ownership_index.md`.
- [ ] Real finding or pitfall written to `memory/`.
