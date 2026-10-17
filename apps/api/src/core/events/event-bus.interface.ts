/**
 * In-process event ports — the Observer seam (`constitution.md` → Approved LLD patterns).
 *
 * Cross-module reactions go through these interfaces, never through a direct call from the
 * emitting module into the reacting one (`constitution.md` → Module boundaries). The first use is
 * `portfolio.published` → site revalidation (`publish-pipeline`).
 *
 * The ports are generic over an **event map** (event name → payload type) so core knows no
 * module's events: each module declares its own map in its `index.ts`, and the composition root
 * combines them into the one map the bus is created with.
 *
 * Publishing and subscribing are split (Interface Segregation): a service that emits depends on
 * `IEventPublisher` only; only `container.ts` subscribes handlers, through `IEventSubscriber`.
 */

/** Names of the events in `TEvents`. */
export type EventName<TEvents extends object> = keyof TEvents & string;

/**
 * Correlation data carried alongside a payload.
 *
 * Holds identifiers only — never secrets or PII — because it is written to logs as-is.
 */
export interface EventMetadata {
  /** Id of the HTTP request that caused the event, so a failing handler's log line joins up. */
  readonly requestId?: string;
}

/** One delivered event. Frozen: a handler cannot change what later handlers receive. */
export interface DomainEvent<TEvents extends object, TName extends EventName<TEvents>> {
  readonly name: TName;
  readonly payload: TEvents[TName];
  readonly meta: EventMetadata;
  /** When `publish()` was called, from the bus's clock. */
  readonly occurredAt: Date;
}

/**
 * A reaction to one event, implemented as a class and registered in `container.ts`.
 *
 * A handler that fails should reject (or throw); the bus logs it and carries on, so one broken
 * reaction never fails the operation that emitted the event.
 */
export interface IEventHandler<TEvents extends object, TName extends EventName<TEvents>> {
  handle(event: DomainEvent<TEvents, TName>): Promise<void>;
}

export interface IEventPublisher<TEvents extends object> {
  /**
   * Delivers an event to every handler subscribed to `name` when the call began, one after the
   * other in subscription order.
   *
   * Resolves once every handler has settled, so the caller may read state a handler recorded.
   * Never rejects because of a handler: failures are logged and swallowed.
   */
  publish<TName extends EventName<TEvents>>(
    name: TName,
    payload: TEvents[TName],
    meta?: EventMetadata,
  ): Promise<void>;
}

export interface IEventSubscriber<TEvents extends object> {
  /**
   * Registers `handler` for `name`.
   *
   * @returns A function that removes this registration; calling it twice is harmless.
   */
  subscribe<TName extends EventName<TEvents>>(
    name: TName,
    handler: IEventHandler<TEvents, TName>,
  ): () => void;
}

/** Both roles, for the composition root that creates the bus and wires handlers. */
export interface IEventBus<TEvents extends object>
  extends IEventPublisher<TEvents>,
    IEventSubscriber<TEvents> {}
