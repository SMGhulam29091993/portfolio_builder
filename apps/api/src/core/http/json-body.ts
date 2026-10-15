/**
 * JSON body parser with an explicit size limit.
 *
 * Multipart is parsed only on the upload route (`media-assets`); every other route uses this
 * parser (`int-standards.express.md` → Framework-specific notes). Its failures — malformed
 * JSON and oversized bodies — are mapped by the error middleware to `VALIDATION_FAILED` and
 * `PAYLOAD_TOO_LARGE`.
 */
import express, { type RequestHandler } from 'express';

/**
 * Largest JSON body accepted, in bytes. Equal to Express's own default (100 KiB), stated
 * explicitly so the limit is visible and reported back as `maxBytes`.
 */
export const JSON_BODY_LIMIT_BYTES = 100 * 1024;

/** Builds the JSON body parser. Call once in the app factory. */
export function createJsonBodyParser(limitBytes: number = JSON_BODY_LIMIT_BYTES): RequestHandler {
  return express.json({ limit: limitBytes });
}
