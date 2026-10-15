/**
 * The only way an API response body is written.
 *
 * Every endpoint answers with the standard envelope `{ success, message, data? }`
 * (`int-standards.express.md` → Standardised response shape). Controllers call `ok`, `created`
 * or `accepted`; failures go through `fail`, which only the error middleware calls — services
 * throw an `AppError` instead.
 */
import type { Response } from 'express';

/** The standard response envelope. */
export interface ApiEnvelope<TData = unknown> {
  readonly success: boolean;
  readonly message: string;
  readonly data?: TData;
}

/** `data` of a failure envelope: the canonical code plus that code's extra fields. */
export interface FailureData {
  readonly code: string;
  readonly [field: string]: unknown;
}

/** 200 — the request succeeded. */
export function ok(res: Response, message: string, data?: unknown): void {
  send(res, 200, true, message, data);
}

/** 201 — a resource was created. */
export function created(res: Response, message: string, data?: unknown): void {
  send(res, 201, true, message, data);
}

/** 202 — the work was accepted and finishes asynchronously. */
export function accepted(res: Response, message: string, data?: unknown): void {
  send(res, 202, true, message, data);
}

/** Error response. `data.code` is always one of the canonical codes. */
export function fail(res: Response, status: number, message: string, data: FailureData): void {
  send(res, status, false, message, data);
}

function send(
  res: Response,
  status: number,
  success: boolean,
  message: string,
  data: unknown,
): void {
  const body: ApiEnvelope = data === undefined ? { success, message } : { success, message, data };
  res.status(status).json(body);
}
