/**
 * Provider responses for the `IDesignGenerator` contract suite (`ai-design-studio.CT01`), in
 * each provider's documented response shape (`memory/ai-provider-apis.md`, confirmed
 * 2026-10-21). They are shaped from the documentation, not captured from a live call: a live
 * run is the manual MT01 / MT02, never CI. Each takes the text the "model" answered with.
 */
import { readFileSync } from 'node:fs';

function recording(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`./recordings/${name}.json`, import.meta.url), 'utf8')) as Record<string, unknown>;
}

/** `POST /api/chat` with `stream: false`. */
export function ollamaChatReply(text: string): unknown {
  const reply = recording('ollama-chat');
  return { ...reply, message: { role: 'assistant', content: text } };
}
