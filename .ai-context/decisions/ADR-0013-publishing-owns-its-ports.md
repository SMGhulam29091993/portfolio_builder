# ADR-0013: `publishing` owns every port it shares with `portfolio` and `design`
**Status:** Accepted — owner, 2026-10-20

## Context
`architecture.md` → Module dependency map listed `publishing → portfolio`
(`IPublishedPointerWriter`, `IPublishedPointerReader`) and `publishing → design`
(`IDesignValidator`) as well as `portfolio → publishing` and `design → publishing`
(`IDraftContributor`). That is two cycles; `constitution.md` → Module boundaries requires a DAG
and the architecture test fails on any cycle (`memory/review-findings.md`, 2026-10-17).

## Decision
Dependency inversion in one direction: `publishing` defines every interface it consumes —
`IDraftContributor`, `IPublishedPointerWriter`, `IPublishedPointerReader` and
`IPublishDesignCheck` — in its own `index.ts`. `portfolio`, `identity` and `design` implement
them. `publishing` depends on `core` and `assets` only; nothing in `publishing` imports
`portfolio`, `identity` or `design`. The container injects the implementations.

## Consequences
- The edges become `portfolio → publishing`, `identity → publishing`, `design → publishing`;
  the cycles are gone and the architecture test can enforce the map as written.
- `IDesignValidator` stays `design`'s own port (used by `ai-design` and the design service); the
  design check `publishing` runs at publish is the narrower `IPublishDesignCheck`, which a
  `design` class implements by delegating to it.
