/**
 * Fixture: core infrastructure. Classes declared outside `modules/` stay constructible anywhere,
 * even when they implement an interface (the logger, the DB connection, the lifecycle).
 */
export interface IClock {
  now(): number;
}

/** Implements an interface but lives in `core/` — `new` of it is legal in a module. */
export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}

/** A plain core value class. */
export class Widget {
  readonly name = 'widget';
}
