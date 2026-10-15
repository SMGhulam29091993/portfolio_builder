# ADR-0004: Publish by immutable snapshot and atomic pointer swap
**Status:** Proposed — needs owner confirmation before `publish-pipeline` becomes `Ready`

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

## Consequences
- No transaction is required; a crash between writing the snapshot and swapping the pointer
  leaves an unreferenced snapshot and an unchanged live site.
- The public read path is one document lookup and never touches draft collections.
- Rollback is instant and does not alter the draft.
- Snapshots accumulate. No pruning policy is defined; acceptable at single-owner volume.
- A change to the published content shape must bump `schemaVersion` and keep older snapshots
  renderable (`constitution.md` → Versioning Rules).
