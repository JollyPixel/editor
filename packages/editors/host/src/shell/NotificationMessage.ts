// Import Third-party Dependencies
import {
  NOTIFICATION_TONES,
  type NotificationInit,
  type NotificationPatch
} from "@jolly-pixel/ui";
import * as z from "zod/mini";

// CONSTANTS
export const NOTIFICATION_MESSAGE_TYPE = "jolly-notification";
const kNotificationSchema = z.object({
  tone: z.enum(NOTIFICATION_TONES),
  title: z.string(),
  message: z.optional(z.string()),
  progress: z.optional(z.nullable(z.number())),
  source: z.optional(z.string()),
  duration: z.optional(z.nullable(z.number()))
});
const kNotificationMessageSchema = z.discriminatedUnion("action", [
  z.object({
    type: z.literal(NOTIFICATION_MESSAGE_TYPE),
    action: z.literal("notify"),
    id: z.string(),
    notification: kNotificationSchema
  }),
  z.object({
    type: z.literal(NOTIFICATION_MESSAGE_TYPE),
    action: z.literal("update"),
    id: z.string(),
    patch: z.partial(kNotificationSchema)
  }),
  z.object({
    type: z.literal(NOTIFICATION_MESSAGE_TYPE),
    action: z.literal("dismiss"),
    id: z.string()
  })
]);

export interface NotifyMessage {
  type: typeof NOTIFICATION_MESSAGE_TYPE;
  action: "notify";
  id: string;
  notification: NotificationInit;
}

export interface UpdateNotificationMessage {
  type: typeof NOTIFICATION_MESSAGE_TYPE;
  action: "update";
  id: string;
  patch: NotificationPatch;
}

export interface DismissNotificationMessage {
  type: typeof NOTIFICATION_MESSAGE_TYPE;
  action: "dismiss";
  id: string;
}

export type NotificationMessage =
  | NotifyMessage
  | UpdateNotificationMessage
  | DismissNotificationMessage;

export function parseNotificationMessage(
  data: unknown
): NotificationMessage | undefined {
  const parsed = kNotificationMessageSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}
