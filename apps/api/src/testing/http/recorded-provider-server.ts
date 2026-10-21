/**
 * `RecordedProviderServer` — a local HTTP server that stands in for an AI provider in the
 * `IDesignGenerator` contract suite (`ai-design-studio.CT01`, CT03). It answers each request
 * with the next scripted reply and records what it received, so adapters run over real
 * `fetch`, real aborts and real status codes with no network beyond the loopback (no live
 * provider call in CI: `ai-design-studio` spec → Non-Functional Constraints).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** One scripted reply. `delayMs` holds it back, for abort tests; `destroy` drops the socket. */
export interface ScriptedReply {
  readonly status?: number;
  readonly body?: unknown;
  readonly delayMs?: number;
  readonly destroy?: boolean;
}

/** What the server received. */
export interface RecordedRequest {
  readonly method: string;
  /** Path and query, as sent. */
  readonly url: string;
  readonly headers: IncomingMessage['headers'];
  /** The parsed JSON body, or `undefined` for none. */
  readonly body: unknown;
}

export class RecordedProviderServer {
  readonly requests: RecordedRequest[] = [];
  private readonly replies: ScriptedReply[] = [];
  /** Replies once the script is used up. */
  fallback: ScriptedReply = { status: 500, body: { error: 'no scripted reply' } };

  private readonly server: Server = createServer((request, response) => {
    void this.handle(request, response);
  });

  /** Starts listening on a free loopback port. */
  static async start(): Promise<RecordedProviderServer> {
    const instance = new RecordedProviderServer();
    await new Promise<void>((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
    return instance;
  }

  /** `http://127.0.0.1:<port>` — the base URL an adapter is pointed at. */
  get url(): string {
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${String(port)}`;
  }

  /** Queues replies, answered in order. */
  reply(...replies: ScriptedReply[]): void {
    this.replies.push(...replies);
  }

  reset(): void {
    this.requests.length = 0;
    this.replies.length = 0;
    this.fallback = { status: 500, body: { error: 'no scripted reply' } };
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    this.requests.push({
      method: request.method ?? '',
      url: request.url ?? '',
      headers: request.headers,
      body: raw === '' ? undefined : (JSON.parse(raw) as unknown),
    });
    const reply = this.replies.shift() ?? this.fallback;
    if (reply.delayMs !== undefined) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
    if (reply.destroy) {
      request.socket.destroy();
      return;
    }
    if (response.destroyed) return;
    response.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
    response.end(reply.body === undefined ? '' : typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
  }
}
