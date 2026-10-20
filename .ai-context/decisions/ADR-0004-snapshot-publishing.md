# ADR-0004: Publish by immutable snapshot and atomic pointer swap
**Status:** Accepted — owner, 2026-10-20, with one amendment: a retention policy (Decision →
Retention), because snapshots are no longer one owner's (ADR-0010)

## Context
BRD-005 needs draft and live content separated, a validated publish, and a way back. Draft
content is spread across several modules' collections. MongoDB multi-document transactions need
a replica set, which a local single-node setup does not have by default.

## Decision
Publishing assembles the whole draft into one immutable document in `snapshots`
(`version` increments per portfolio; `contentHash` is the SHA-256 of canonical JSON). The live
site is whichever snapshot `portfolios.publishedSnapshotId` points to. Publish and rollback are
both a single atomic update of that pointer. "Unpublished changes" is computed by comparing the
draft hash with the current snapshot's hash.

### Retention (amendment, owner 2026-10-20)
Each portfolio keeps its newest 20 snapshots. After a publish, older snapshots of that portfolio
are deleted, except the one the published pointer names (after a rollback the live snapshot can
be older than the newest 20). Pruning runs after the pointer swap and never fails a publish; a
pruning failure is logged and retried by the next publish. Rollback is possible to any kept
snapshot.

## Consequences
- No transaction is required; a crash between writing the snapshot and swapping the pointer
  leaves an unreferenced snapshot and an unchanged live site.
- The public read path is one document lookup and never touches draft collections.
- Rollback is instant and does not alter the draft.
- Snapshots are bounded per portfolio by the retention rule above; a snapshot older than the
  newest 20 (and not live) can no longer be rolled back to.
- A change to the published content shape must bump `schemaVersion` and keep older snapshots
  renderable (`constitution.md` → Versioning Rules).
