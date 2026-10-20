// Import Third-party Dependencies
import * as z from "zod/mini";

export const projectionRecordSchema = z.record(z.string(), z.unknown());

export const projectionCheckpointSchema = z.int();

export const projectionFailureSchema = z.object({
  eventId: z.int(),
  attempts: z.int(),
  reason: z.string()
});
