/**
 * Unit tests for the in-process Observer seam (`constitution.md` → Approved LLD patterns).
 * The logger is a recording fake; no datastore or network is involved.
 */
import { describe, expect, it } from 'vitest';

import { RecordingLogger } from '../../testing/index.js';
import type { ILogger } from '../logger/logger.interface.js';
import type { DomainEvent, EventName, IEventHandler } from './event-bus.interface.js';
import { InProcessEventBus } from './in-process-event-bus.js';

/** Event map used only by these tests. */
interface TestEvents {
  'thing.happened': { readonly id: string; readonly email: string };
  'other.happened': { readonly count: number };
}

const FIXED_NOW = new Date('2026-10-17T10:00:00.000Z');

/** Handler that records what it received into a shared log, then optionally throws. */
class RecordingHandler<TName extends EventName<TestEvents>>
  implements IEventHandler<TestEvents, TName>
{
  constructor(
    private readonly label: string,
    private readonly calls: string[],
    private readonly received: DomainEvent<TestEvents, TName>[] = [],
    private readonly failWith?: Error,
  ) {}

  handle(event: DomainEvent<TestEvents, TName>): Promise<void> {
    this.calls.push(this.label);
    this.received.push(event);
    return this.failWith ? Promise.reject(this.failWith) : Promise.resolve();
  }
}

function createBus(logger: ILogger = new RecordingLogger()): InProcessEventBus<TestEvents> {
  return new InProcessEventBus<TestEvents>(logger, () => FIXED_NOW);
}

describe('InProcessEventBus', () => {
  it('monorepo-foundation.UT10 — delivers the event to every handler, in subscription order', async () => {
    const bus = createBus();
    const calls: string[] = [];
    const received: DomainEvent<TestEvents, 'thing.happened'>[] = [];
    bus.subscribe('thing.happened', new RecordingHandler('first', calls, received));
    bus.subscribe('thing.happened', new RecordingHandler('second', calls));

    await bus.publish('thing.happened', { id: 't1', email: 'a@b.c' }, { requestId: 'req-1' });

    expect(calls).toEqual(['first', 'second']);
    expect(received).toEqual([
      {
        name: 'thing.happened',
        payload: { id: 't1', email: 'a@b.c' },
        meta: { requestId: 'req-1' },
        occurredAt: FIXED_NOW,
      },
    ]);
    expect(Object.isFrozen(received[0])).toBe(true);
  });

  it('monorepo-foundation.UT11 — logs a throwing handler with the request id and keeps going', async () => {
    const logger = new RecordingLogger();
    const bus = createBus(logger);
    const calls: string[] = [];
    bus.subscribe(
      'thing.happened',
      new RecordingHandler('failing', calls, [], new Error('revalidation refused')),
    );
    bus.subscribe('thing.happened', new RecordingHandler('after', calls));

    await expect(
      bus.publish('thing.happened', { id: 't1', email: 'owner@example.com' }, { requestId: 'req-9' }),
    ).resolves.toBeUndefined();

    expect(calls).toEqual(['failing', 'after']);
    expect(logger.entries).toEqual([
      {
        level: 'error',
        message: 'event handler failed',
        context: {
          event: 'thing.happened',
          handler: 'RecordingHandler',
          requestId: 'req-9',
          error: expect.any(Error) as unknown,
        },
      },
    ]);
    // The payload may carry PII; it never reaches the log.
    expect(JSON.stringify(logger.entries)).not.toContain('owner@example.com');
  });

  it('monorepo-foundation.UT12 — stops delivering after unsubscribe and isolates event names', async () => {
    const bus = createBus();
    const calls: string[] = [];
    const unsubscribe = bus.subscribe('thing.happened', new RecordingHandler('thing', calls));
    bus.subscribe('other.happened', new RecordingHandler('other', calls));

    unsubscribe();
    await bus.publish('thing.happened', { id: 't2', email: 'a@b.c' });
    await bus.publish('other.happened', { count: 1 });

    expect(calls).toEqual(['other']);
  });

  it('resolves when an event has no subscribers, with empty metadata by default', async () => {
    const bus = createBus();
    const received: DomainEvent<TestEvents, 'other.happened'>[] = [];
    await expect(bus.publish('thing.happened', { id: 't3', email: 'a@b.c' })).resolves.toBeUndefined();

    bus.subscribe('other.happened', new RecordingHandler('other', [], received));
    await bus.publish('other.happened', { count: 2 });

    expect(received[0]?.meta).toEqual({});
  });

  it('delivers to the handlers subscribed when publish began, even if one subscribes mid-delivery', async () => {
    const bus = createBus();
    const calls: string[] = [];
    const late = new RecordingHandler('late', calls);

    /** Subscribes another handler while the bus is delivering to it. */
    class SubscribingHandler implements IEventHandler<TestEvents, 'thing.happened'> {
      handle(): Promise<void> {
        calls.push('subscriber');
        bus.subscribe('thing.happened', late);
        return Promise.resolve();
      }
    }
    bus.subscribe('thing.happened', new SubscribingHandler());

    await bus.publish('thing.happened', { id: 't4', email: 'a@b.c' });
    expect(calls).toEqual(['subscriber']);
  });
});
