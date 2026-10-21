/**
 * The shared `IDesignGenerator` / `IProviderHealth` contract suite (`constitution.md` → Liskov
 * Substitution; `ai-design-studio.AC13`):
 *
 * - CT01 — every adapter returns the model's raw text, sends the JSON Schema it was given,
 *   honours the abort signal, surfaces every transport failure as `UpstreamError` (a refusal as
 *   its `ProviderRejectedError` subclass) and never puts a credential in a URL;
 * - CT02 — the same, through the timeout and retry decorators around each adapter;
 * - CT03 — the health check answers `reachable` true or false and never throws.
 *
 * Network adapters run against `RecordedProviderServer` on the loopback, in their documented
 * response shapes; the stub joins for what applies to it. Each adapter task adds its subject.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { UpstreamError } from '../../../core/errors/index.js';
import { SystemDelay } from '../../../core/time/index.js';
import {
  geminiInteractionReply,
  ollamaChatReply,
  openRouterCompletionReply,
  RecordedProviderServer, type RecordedRequest, type ScriptedReply } from '../../../testing/index.js';
import { FetchHttpClient } from '../adapters/fetch-http.client.js';
import { ProviderRejectedError } from '../ai-design.errors.js';
import type { IDesignGenerator, IProviderHealth } from '../ai-design.interface.js';
import type { GenerationRequest } from '../ai-design.types.js';
import { RetryDesignGenerator } from '../decorators/retry.design-generator.js';
import { TimeoutDesignGenerator } from '../decorators/timeout.design-generator.js';
import { GeminiDesignGenerator } from './gemini.design-generator.js';
import { OllamaDesignGenerator } from './ollama.design-generator.js';
import { OpenRouterDesignGenerator } from './openrouter.design-generator.js';
import { StubDesignGenerator } from './stub.design-generator.js';

/** A secret no URL may carry (CT01). */
const SECRET = 'contract-suite-not-a-real-key';
const MODEL = 'contract-model';

const request: GenerationRequest = {
  instructions: 'Choose a design from the catalogue.',
  messages: [
    { role: 'user', content: 'Calm and editorial' },
    { role: 'assistant', content: '{"theme":1}' },
    { role: 'user', content: 'That answer cannot be used.' },
  ],
  schema: { type: 'object', properties: { theme: { type: 'object' } }, required: ['theme'], additionalProperties: false },
  schemaName: 'design_proposal',
};

/** Raw text with a fence and prose: an adapter must hand it back untouched, never parse it. */
const RAW = 'Here you go:\n```json\n{"theme":{},"layout":{}}\n```';

let server: RecordedProviderServer;

beforeAll(async () => {
  server = await RecordedProviderServer.start();
});
afterEach(() => {
  server.reset();
});
afterAll(async () => {
  await server.stop();
});

/** A network adapter, as the suite drives it. */
interface NetworkSubject {
  readonly name: string;
  readonly create: (baseUrl: string) => IDesignGenerator & IProviderHealth;
  /** A successful provider answer whose model text is `text`. */
  readonly success: (text: string) => ScriptedReply;
  /** Where the adapter put the JSON Schema in its request body. */
  readonly schemaSent: (sent: RecordedRequest) => unknown;
  /** The path the health check calls. */
  readonly healthPath: string;
}

const http = new FetchHttpClient();
const ollama = (baseUrl: string) => new OllamaDesignGenerator({ baseUrl, model: MODEL, probeTimeoutMs: 1_000 }, http);
const openRouter = (baseUrl: string) =>
  new OpenRouterDesignGenerator({ baseUrl, apiKey: SECRET, model: MODEL, probeTimeoutMs: 1_000 }, http);
const gemini = (baseUrl: string) => new GeminiDesignGenerator({ baseUrl, apiKey: SECRET, model: MODEL, probeTimeoutMs: 1_000 }, http);

/** CT02: the composition the container builds — adapter → retry → timeout. */
function decorated(adapter: IDesignGenerator & IProviderHealth): IDesignGenerator & IProviderHealth {
  const delay = new SystemDelay();
  const generator = new TimeoutDesignGenerator(new RetryDesignGenerator(adapter, delay, { attempts: 2, baseDelayMs: 1 }), delay, 5_000);
  return { providerId: generator.providerId, generate: (...args) => generator.generate(...args), check: () => adapter.check() };
}

const NETWORK_SUBJECTS: readonly NetworkSubject[] = [
  {
    name: 'OllamaDesignGenerator',
    create: ollama,
    success: (text) => ({ body: ollamaChatReply(text) }),
    schemaSent: (sent) => (sent.body as { format?: unknown }).format,
    healthPath: '/api/tags',
  },
  {
    name: 'GeminiDesignGenerator',
    create: gemini,
    success: (text) => ({ body: geminiInteractionReply(text) }),
    schemaSent: (sent) => (sent.body as { response_format?: { schema?: unknown } }).response_format?.schema,
    healthPath: '/models',
  },
  {
    name: 'OpenRouterDesignGenerator',
    create: openRouter,
    success: (text) => ({ body: openRouterCompletionReply(text) }),
    schemaSent: (sent) => (sent.body as { response_format?: { json_schema?: { schema?: unknown } } }).response_format?.json_schema?.schema,
    healthPath: '/models',
  },
];

/** Every network subject, bare (CT01) and decorated (CT02). */
const SUBJECTS = NETWORK_SUBJECTS.flatMap((subject) => [
  { ...subject, suite: 'CT01' },
  { ...subject, name: `${subject.name} with retry and timeout`, suite: 'CT02', create: (baseUrl: string) => decorated(subject.create(baseUrl)) },
]);

/** The error a call rejected with; fails the test when it resolved. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to reject');
}

/** No provider-specific type crosses the port. */
function expectPortError(error: unknown, provider: string): void {
  expect(error).toBeInstanceOf(UpstreamError);
  expect(['UpstreamError', 'ProviderRejectedError', 'ProviderTimeoutError']).toContain((error as Error).constructor.name);
  expect(error).toMatchObject({ code: 'UPSTREAM_FAILED', details: { provider } });
}

describe.each(SUBJECTS)('ai-design-studio.$suite — IDesignGenerator contract — $name', (subject) => {
  it('returns the raw text, untouched', async () => {
    server.reply(subject.success(RAW));
    await expect(subject.create(server.url).generate(request, new AbortController().signal)).resolves.toEqual({ text: RAW });
  });

  it('sends the JSON Schema it was given, the instructions and every message', async () => {
    server.reply(subject.success('{}'));
    await subject.create(server.url).generate(request, new AbortController().signal);
    const [sent] = server.requests;
    if (sent === undefined) throw new Error('the adapter sent nothing');
    expect(sent.method).toBe('POST');
    expect(subject.schemaSent(sent)).toEqual(request.schema);
    const body = JSON.stringify(sent.body);
    expect(body).toContain(request.instructions);
    for (const message of request.messages) expect(body).toContain(JSON.stringify(message.content));
  });

  it('honours the abort signal: a held answer is abandoned with UpstreamError', async () => {
    server.reply({ ...subject.success('{}'), delayMs: 3_000 });
    const controller = new AbortController();
    const started = Date.now();
    const call = subject.create(server.url).generate(request, controller.signal);
    setTimeout(() => {
      controller.abort(new Error('caller gave up'));
    }, 50);
    expectPortError(await rejection(call), subject.create(server.url).providerId);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('a 4xx refusal is ProviderRejectedError — an UpstreamError', async () => {
    server.reply({ status: 401, body: { error: 'bad key' } });
    const error = await rejection(subject.create(server.url).generate(request, new AbortController().signal));
    expectPortError(error, subject.create(server.url).providerId);
    expect(error).toBeInstanceOf(ProviderRejectedError);
  });

  it.each([
    ['a 429', { status: 429, body: { error: 'slow down' } }],
    ['a 503', { status: 503, body: { error: 'overloaded' } }],
    ['a dropped connection', { destroy: true }],
    ['a body that is not JSON', { status: 200, body: 'not json' }],
    ['a JSON body of the wrong shape', { status: 200, body: { unexpected: true } }],
  ])('%s is UpstreamError, not a refusal', async (_case, reply: ScriptedReply) => {
    server.fallback = reply;
    const error = await rejection(subject.create(server.url).generate(request, new AbortController().signal));
    expectPortError(error, subject.create(server.url).providerId);
    expect(error).not.toBeInstanceOf(ProviderRejectedError);
  });

  it('an unreachable provider is UpstreamError', async () => {
    const error = await rejection(subject.create('http://127.0.0.1:1').generate(request, new AbortController().signal));
    expectPortError(error, subject.create(server.url).providerId);
  });

  it('puts no credential in any URL', async () => {
    server.reply(subject.success('{}'));
    await subject.create(server.url).generate(request, new AbortController().signal);
    for (const sent of server.requests) {
      expect(sent.url).not.toContain(SECRET);
      expect(sent.url).not.toMatch(/[?&](key|api_key|token)=/i);
    }
  });

  it('ai-design-studio.CT03 — health: reachable on a 2xx, not on an error or when down, never throwing', async () => {
    server.reply({ status: 200, body: {} });
    await expect(subject.create(server.url).check()).resolves.toEqual({ reachable: true });
    expect(server.requests[0]).toMatchObject({ method: 'GET', url: subject.healthPath });
    server.reply({ status: 500, body: {} });
    await expect(subject.create(server.url).check()).resolves.toEqual({ reachable: false });
    await expect(subject.create('http://127.0.0.1:1').check()).resolves.toEqual({ reachable: false });
  });
});

describe('ai-design-studio.CT01 — IDesignGenerator contract — StubDesignGenerator', () => {
  it('returns raw text; honours an aborted signal with UpstreamError; is reachable', async () => {
    const stub = new StubDesignGenerator();
    const { text } = await stub.generate(request, new AbortController().signal);
    expect(typeof text).toBe('string');
    const aborted = new AbortController();
    aborted.abort();
    expectPortError(await rejection(stub.generate(request, aborted.signal)), 'stub');
    await expect(stub.check()).resolves.toEqual({ reachable: true });
  });
});

describe('OllamaDesignGenerator wire format', () => {
  it('posts to /api/chat with the model, the system turn first, stream off; keeps a base path', async () => {
    server.reply({ body: ollamaChatReply('{}') });
    await ollama(`${server.url}/proxy/`).generate(request, new AbortController().signal);
    const [sent] = server.requests;
    expect(sent?.url).toBe('/proxy/api/chat');
    expect(sent?.body).toMatchObject({
      model: MODEL,
      stream: false,
      messages: [{ role: 'system', content: request.instructions }, ...request.messages],
    });
  });
});

describe('GeminiDesignGenerator wire format', () => {
  it('posts to <base>/interactions with the key in a header, system_instruction, steps as input and a top-level response_format', async () => {
    server.reply({ body: geminiInteractionReply('{}') });
    await gemini(`${server.url}/v1beta`).generate(request, new AbortController().signal);
    const [sent] = server.requests;
    expect(sent?.url).toBe('/v1beta/interactions');
    expect(sent?.headers['x-goog-api-key']).toBe(SECRET);
    expect(sent?.body).toEqual({
      model: MODEL,
      system_instruction: request.instructions,
      input: [
        { type: 'user_input', content: [{ type: 'text', text: 'Calm and editorial' }] },
        { type: 'model_output', content: [{ type: 'text', text: '{"theme":1}' }] },
        { type: 'user_input', content: [{ type: 'text', text: 'That answer cannot be used.' }] },
      ],
      response_format: { type: 'text', mime_type: 'application/json', schema: request.schema },
    });
  });

  it('reads the last model_output step, skipping thoughts, joining its text parts', async () => {
    server.reply({
      body: {
        steps: [
          { type: 'thought', summary: [{ type: 'text', text: 'ignored' }] },
          { type: 'model_output', content: [{ type: 'text', text: '{"a":' }, { type: 'image' }, { type: 'text', text: '1}' }] },
        ],
      },
    });
    await expect(gemini(server.url).generate(request, new AbortController().signal)).resolves.toEqual({ text: '{"a":1}' });
  });

  it('sends the key to the health check in a header too', async () => {
    server.reply({ status: 200, body: { models: [] } });
    await gemini(server.url).check();
    expect(server.requests[0]?.headers['x-goog-api-key']).toBe(SECRET);
  });
});

describe('OpenRouterDesignGenerator wire format', () => {
  it('posts to <base>/chat/completions with a bearer key, strict json_schema and require_parameters', async () => {
    server.reply({ body: openRouterCompletionReply('{}') });
    await openRouter(`${server.url}/api/v1`).generate(request, new AbortController().signal);
    const [sent] = server.requests;
    expect(sent?.url).toBe('/api/v1/chat/completions');
    expect(sent?.headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(sent?.body).toEqual({
      model: MODEL,
      messages: [{ role: 'system', content: request.instructions }, ...request.messages],
      response_format: { type: 'json_schema', json_schema: { name: 'design_proposal', strict: true, schema: request.schema } },
      provider: { require_parameters: true },
    });
  });

  it('an empty choices list is UpstreamError', async () => {
    server.reply({ body: { choices: [] } });
    await expect(openRouter(server.url).generate(request, new AbortController().signal)).rejects.toBeInstanceOf(UpstreamError);
  });
});
