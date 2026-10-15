# Workflow: Spec readiness check

Replaces the Gate Review Dashboard of the hybrid guide. Built fresh every time.

1. Iterate `.ai-context/specs/*.spec.md` — every file there is a spec, by construction.
2. Sort each into exactly one bucket, never merged:
   - **Blocked draft** — `Draft` with an unresolved Open Question or a `Proposed` ADR it depends
     on. Always list which question or ADR.
   - **Ready to confirm** — `Draft`, Definition of Ready passes, nothing blocking. The owner can
     move it to `Ready`.
   - **Ready, not started** — `Ready` with no task `inprogress`.
   - **Revised** — carries a `⚠️ REVISED` line and has not been re-checked.
3. Report the buckets with one line per spec. Do not change any status — only the owner moves a
   spec to `Ready`.
