/**
 * Public surface of `core/events`: the event ports and the in-process bus that implements them.
 * Only `container.ts` creates the bus; everything else depends on the interfaces.
 */
export type {
  DomainEvent,
  EventMetadata,
  EventName,
  IEventBus,
  IEventHandler,
  IEventPublisher,
  IEventSubscriber,
} from './event-bus.interface.js';
export { InProcessEventBus } from './in-process-event-bus.js';
