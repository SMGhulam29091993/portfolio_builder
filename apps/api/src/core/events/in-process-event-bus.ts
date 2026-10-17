/**
 * Synchronous-in-order, in-memory implementation of `IEventBus`.
 *
 * Delivery happens inside the publishing process, after the caller's writes and before
 * `publish()` resolves (`publish-pipeline.spec.md` → Error Handling: listeners run after the
 * response path's writes; a throwing listener is logged with the request id and cannot fail the
 * publish). Nothing is persisted: an event published while the process dies is lost. A durable
 * outbox is explicitly deferred (`publish-pipeline.plan.md` → Explicitly Deferred).
 */
import type { ILogger } from '../logger/logger.interface.js';
import type {
  DomainEvent,
  EventMetadata,
  EventName,
  IEventBus,
  IEventHandler,
} from './event-bus.interface.js';

/**
 * Handler with its event type widened to any event of the map, so handlers for different events
 * share one map. This is sound only because `subscribe()` is the one writer and files each
 * handler under the event name it was typed for, so `publish()` hands it only that event.
 */
type StoredHandler<TEvents extends object> = IEventHandler<TEvents, EventName<TEvents>>;

export class InProcessEventBus<TEvents extends object> implements IEventBus<TEvents> {
  /** Handlers per event name, in subscription order. */
  private readonly handlers = new Map<EventName<TEvents>, StoredHandler<TEvents>[]>();

  /**
   * @param logger - Receives one `error` entry per failed handler.
   * @param now - Clock for `occurredAt`; injected so tests are deterministic.
   */
  constructor(
    private readonly logger: ILogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  subscribe<TName extends EventName<TEvents>>(
    name: TName,
    handler: IEventHandler<TEvents, TName>,
  ): () => void {
    const stored = handler as unknown as StoredHandler<TEvents>;
    const list = this.handlers.get(name) ?? [];
    this.handlers.set(name, [...list, stored]);

    return () => {
      const current = this.handlers.get(name) ?? [];
      this.handlers.set(
        name,
        current.filter((entry) => entry !== stored),
      );
    };
  }

  async publish<TName extends EventName<TEvents>>(
    name: TName,
    payload: TEvents[TName],
    meta: EventMetadata = {},
  ): Promise<void> {
    const event: DomainEvent<TEvents, TName> = Object.freeze({
      name,
      payload,
      meta: Object.freeze({ ...meta }),
      occurredAt: this.now(),
    });

    // Lists are replaced, never mutated, on (un)subscribe, so this reference is a stable snapshot
    // even if a handler subscribes or unsubscribes while delivery is under way.
    const recipients = this.handlers.get(name) ?? [];

    for (const handler of recipients) {
      try {
        await handler.handle(event);
      } catch (error) {
        // Name, handler class and correlation id only: the payload may carry PII
        // (`constitution.md` → PII / logging rules).
        this.logger.error('event handler failed', {
          event: name,
          handler: handler.constructor.name,
          requestId: meta.requestId,
          error,
        });
      }
    }
  }
}
