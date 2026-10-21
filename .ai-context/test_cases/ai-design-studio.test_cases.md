# Test Cases: AI Design Studio
**Spec:** .ai-context/specs/ai-design-studio.spec.md
**Spec-derived unit cases:** UT01–UT16 are defined in the spec and not restated here.
No test in CI calls a real provider. Integration tests use the stub or a scripted fake generator.

## Integration (real MongoDB, real HTTP, fake or stub generator)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| ai-design-studio.IT01 | AC1, AC2 | POST a prompt with the stub; poll API02 | 202 `pending`; then `ready` with a valid design |
| ai-design-studio.IT02 | AC1 | POST with a generator that resolves after a delay | 202 returns before the generator resolves |
| ai-design-studio.IT03 | AC3 | Generator returns prose twice | `failed` / `INVALID_OUTPUT`; `design` null |
| ai-design-studio.IT04 | AC4 | Generator returns a low-contrast design, then a valid one | `ready`; generator called twice |
| ai-design-studio.IT05 | AC7 | POST while one is pending | 409 `GENERATION_IN_PROGRESS` with its id |
| ai-design-studio.IT06 | AC7, AC17 | A member uses the free monthly allowance, POSTs again; the owner POSTs past it | 402 `CREDITS_REQUIRED`, nothing stored; the owner's 202; a member's POST succeeds again after the clock passes the month |
| ai-design-studio.IT07 | AC8 | Apply a ready proposal | Design revision + 1; proposal `applied`; published snapshot unchanged |
| ai-design-studio.IT08 | AC9 | Apply a failed proposal; apply with a stale revision | 409 `PROPOSAL_NOT_READY`; 409 `REVISION_CONFLICT` |
| ai-design-studio.IT09 | AC10 | Insert a pending proposal, run startup hooks | `failed` / `INTERRUPTED`; a new POST is accepted |
| ai-design-studio.IT10 | AC12 | Boot in production mode for each failing row of the environment table | Each exits naming the variable |
| ai-design-studio.IT11 | AC15 | Capture the request passed to the generator and the logs | No name, email or section text in the request; no prompt or key in logs |
| ai-design-studio.IT12 | Edge | Discard a pending proposal; discard a ready one | 409; 200 and excluded from the list |
| ai-design-studio.IT13 | Auth | Each route with no cookie | 401 |
| ai-design-studio.IT14 | Edge | Concurrent POSTs | Exactly one 202 (partial unique index) |
| ai-design-studio.IT15 | AC14 | Each adapter, built by the factory from its environment row, runs create → ready against recorded HTTP | Same flow passes unchanged; each proposal records its provider and model |

## Contract suites
| Test ID | Interface | Asserts |
|---|---|---|
| ai-design-studio.CT01 | `IDesignGenerator` — stub, Ollama, Gemini, OpenRouter (recorded HTTP) — AC13 | Returns raw text; sends the generated JSON Schema; aborts on signal; maps 4xx / 5xx / network errors to `UpstreamError`; sends no credential in a URL |
| ai-design-studio.CT02 | `IDesignGenerator` decorators | Timeout and retry wrappers satisfy CT01 around any adapter |
| ai-design-studio.CT03 | `IProviderHealth` | `reachable` true / false without throwing |
| ai-design-studio.CT04 | `IProposalRepository` — `ProposalRepository` (real MongoDB), `InMemoryProposalRepository` | One pending per portfolio, conditional completion and transitions, cursor paging with ties, the monthly free count, the once-only refund flag, pending list, `deletePending` |

## Manual, opt-in (never in CI)
| Test ID | Scenario | Expected |
|---|---|---|
| ai-design-studio.MT01 | With a local Ollama model pulled, run one generation per scope | `ready` proposals; record duration to set `AI_TIMEOUT_MS` |
| ai-design-studio.MT02 | With real Gemini and OpenRouter keys in a private `.env`, run one generation each | `ready` proposals; record model ids and durations in the plan |

## End to end (stub provider)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| ai-design-studio.E2E01 | AC16 | Submit a prompt, wait, preview at both widths | Preview shows the proposal's theme; draft design unchanged |
| ai-design-studio.E2E02 | AC16 | Apply, then open Design | Design screen shows the applied tokens |
| ai-design-studio.E2E03 | AC16 | Discard a proposal | Removed from history |
| ai-design-studio.E2E04 | AC16 | Provider badge with the stub | "Stub (development)" |

## Data variations
- Prompts: 1 character, 600, 601 (400), with HTML, with model-directed instructions.
- Model outputs: fenced JSON, JSON with trailing prose, two JSON objects, empty string, truncated JSON.
