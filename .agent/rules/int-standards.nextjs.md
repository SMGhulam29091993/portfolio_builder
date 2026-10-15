# Next.js + React Coding Standards

**Applies to:** `apps/web/**`, `packages/sections/**`, `packages/design-tokens/**`.

## Structure
```
apps/web/src/app/
├── (site)/                 # Public portfolio — Server Components, no auth, no client data fetching
├── (cms)/cms/              # CMS panel — authenticated, noindex
└── api/revalidate/route.ts # Secret-protected revalidation hook
packages/sections/          # Section renderers + variant registry (site AND CMS preview use these)
packages/design-tokens/     # Token types, default theme, CSS-variable emitter, contrast helpers
packages/contracts/         # zod schemas + inferred types shared with apps/api
```
The public site and the CMS preview render through the same `packages/sections` components. A
second renderer for the same section is never written.

## Adding a section type or layout variant
1. Payload schema in `packages/contracts/src/sections/<type>.ts`
2. Renderer in `packages/sections/src/<type>/<variant>.tsx`, registered in the variant registry
3. Editor form in `apps/web/src/app/(cms)/cms/sections/_editors/<type>.tsx`, registered in the
   editor registry
4. API-side `SectionDefinition` (see `int-standards.express.md`)
The page composer, the section editor host and the section engine are not edited.

## Components
- Function components only. Server Components by default; add `'use client'` only for
  interactivity (forms, copy-to-clipboard, motion, preview frame).
- Section renderers are pure: props in (`data`, `identity`, `theme`, `index`), markup out. No
  data fetching, no global state, no `window` access outside effects.
- No business payloads in components — every visible string comes from props.
- Strings are rendered as text. `dangerouslySetInnerHTML` is banned.

## Styling
- Tailwind utilities driven by CSS variables emitted from `ThemeTokens`
  (`--color-background`, `--color-accent`, `--radius`, …). No hex literal or font name in a
  component.
- Fonts load through `next/font` from the allow-list in `packages/design-tokens`. No font URL is
  ever taken from stored data.
- Breakpoints are mobile-first. The two reference widths, 390 and 1440, are the acceptance
  viewports; behaviour between them must not break layout at 768 and 1024.

## Motion
- `motion` components only where the spec names an animation. Every animation respects
  `prefers-reduced-motion` and the theme's `effects.motion` setting (`none` disables all).

## State and data
- **Server state (CMS):** TanStack Query. Query keys and API calls live in
  `apps/web/src/lib/api/<area>.ts`, typed from `packages/contracts`.
- **Forms:** react-hook-form with the zod resolver, using the same schema the API validates
  with — client and server validation never diverge.
- **Local UI state:** component state first; a Zustand store only for cross-component UI state
  (preview viewport, unsaved-changes registry). Never mirror server data into a store.
- **Public site:** fetches the published snapshot on the server only; no client fetching.

## API access
- The browser calls same-origin `/api/v1/**`, proxied to `apps/api` by a Next.js rewrite, so auth
  cookies stay first-party. Server-side fetches use `API_INTERNAL_URL`.
- A 401 triggers one silent refresh and one retry; a second 401 redirects to `/cms/login`.
- A 409 `REVISION_CONFLICT` never overwrites silently — the editor shows the conflict and offers
  reload or keep-editing.

## Accessibility (hard rule)
- Semantic landmarks (`header`, `nav`, `main`, `section[aria-labelledby]`, `footer`); exactly one
  `h1` per page; heading levels never skip.
- Every interactive element is keyboard reachable with a visible focus ring; icon-only links have
  an accessible name.
- Form fields have labels and associate their error text with `aria-describedby`.
- Evaluation signal: axe checks and Playwright visual baselines run alongside unit tests.

## Framework-specific notes
- Caching and revalidation APIs have changed between Next.js majors. Before implementing
  `public-site-rendering.T03`, confirm tag-based revalidation against the installed version's
  documentation and record what was found in `memory/` if it differs from the plan.
