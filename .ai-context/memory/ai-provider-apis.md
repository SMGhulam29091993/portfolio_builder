# AI provider wire formats — confirmed 2026-10-21 (`ai-design-studio.T06`–`T08`)
Re-confirm before changing an adapter; these surfaces change.

| Provider | Request | Where the text is |
|---|---|---|
| Ollama | `POST {OLLAMA_BASE_URL}/api/chat`, body `{ model, messages, stream: false, format: <JSON Schema> }` | `message.content` (a JSON string) |
| OpenRouter | `POST https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer <key>`, body `{ model, messages, response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }, provider: { require_parameters: true } }` | `choices[0].message.content` |
| Gemini | `POST https://generativelanguage.googleapis.com/v1beta/interactions`, header `x-goog-api-key`, body `{ model, input, system_instruction, response_format: { type: "text", mime_type: "application/json", schema } }` — `response_format` is top-level, not in `generation_config`. A conversation is `input: [{ type: "user_input" \| "model_output", content: [{ type: "text", text }] }]` (re-read 2026-10-21 for T07) | `steps[]` item with `type: "model_output"` → its `content[]` item with `type: "text"` → `text` |

OpenRouter, 2026-10-21: model ids are namespaced (`google/gemini-3.5-flash`); `max_tokens` is
sent from `AI_MAX_OUTPUT_TOKENS` when set, since without it the full output limit is reserved
against the credits (HTTP 402 on a small balance). Gemini refuses a structured-output schema it
finds too large with HTTP 400; the base schema plus one custom layout tree was accepted, all six
trees were not (`memory/pitfalls.md`, 2026-10-21).

Sources: ai.google.dev/gemini-api/docs/structured-output (documents structured output only on the
Interactions API), ai.google.dev/api/interactions-api (resource schema), openrouter.ai/docs
(structured outputs, provider routing), docs.ollama.com/capabilities/structured-outputs.
