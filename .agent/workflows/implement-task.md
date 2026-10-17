# Workflow: Implement one task

**Input:** a task ID, e.g. `publish-pipeline.T04`.

1. Read the task, the AC IDs it names, and the plan section it belongs to. Nothing else unless
   the task points at it.
2. Confirm the spec is `Ready` or `In Progress`, and every earlier task in the file is
   `completed`. If not, stop and say so.
3. Mark the task `inprogress` in the tasks file and in `state/current.md`.
4. Write the failing tests first for anything in the test-first scope (`constitution.md`).
5. Implement the smallest change that satisfies the named ACs. Do not touch other tasks' scope.
6. Run typecheck, lint, the affected tests, and the architecture test — plus `pnpm test:e2e`
   when the change touches `apps/web` or a route an E2E spec calls.
7. Run `.agent/workflows/code-review.md` against the diff. Fix findings; record real ones in
   `memory/review-findings.md`.
8. Update state files and the spec status per `state-tracking.md`; record the DoD self-check
   line; mark the task `completed`.
