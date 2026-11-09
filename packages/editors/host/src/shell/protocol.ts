// Import Third-party Dependencies
import {
  DENSITIES,
  NOTIFICATION_TONES,
  THEME_MODES
} from "@jolly-pixel/ui";
import * as z from "zod/mini";

// Import Internal Dependencies
import { EDITOR_STATES } from "../mount/EditorState.ts";
import { PLAY_SCOPES } from "./playShortcut.ts";

// CONSTANTS
const kOverridesSchema = z.record(z.string(), z.unknown());
const kAppearanceSchema = z.object({
  theme: z.enum(THEME_MODES),
  density: z.enum(DENSITIES)
});
const kNotificationSchema = z.object({
  tone: z.enum(NOTIFICATION_TONES),
  title: z.string(),
  message: z.optional(z.string()),
  progress: z.optional(z.nullable(z.number())),
  source: z.optional(z.string()),
  duration: z.optional(z.nullable(z.number()))
});
const kLaunchIdentitySchema = z.object({
  username: z.string().check(z.trim(), z.minLength(1)),
  peerId: z.string().check(z.minLength(1)),
  avatar: z.catch(z.optional(z.string()), undefined)
});
const kLaunchPortsSchema = z.object({
  catalog: z.optional(z.instanceof(MessagePort)),
  console: z.optional(z.instanceof(MessagePort))
});
const kFrameMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("jolly-ready")
  }),
  z.object({
    type: z.literal("jolly-open-asset"),
    target: z.string(),
    reveal: z.optional(z.string())
  }),
  z.object({
    type: z.literal("jolly-toggle-console")
  }),
  z.object({
    type: z.literal("jolly-play"),
    scope: z.enum(PLAY_SCOPES)
  }),
  z.object({
    type: z.literal("jolly-session-refused")
  }),
  z.object({
    type: z.literal("jolly-unsaved"),
    unsaved: z.boolean()
  }),
  z.object({
    type: z.literal("jolly-editor-state"),
    state: z.enum(EDITOR_STATES)
  }),
  z.object({
    type: z.literal("jolly-update-preferences"),
    scope: z.string(),
    patch: kOverridesSchema
  }),
  z.object({
    type: z.literal("jolly-notification"),
    id: z.string(),
    notification: kNotificationSchema
  }),
  z.object({
    type: z.literal("jolly-notification-update"),
    id: z.string(),
    patch: z.partial(kNotificationSchema)
  }),
  z.object({
    type: z.literal("jolly-notification-dismiss"),
    id: z.string()
  })
]);
const kLaunchMessageSchema = z.object({
  type: z.literal("jolly-launch"),
  target: z.string(),
  reveal: z.catch(z.optional(z.string()), undefined),
  appearance: z.catch(z.optional(kAppearanceSchema), undefined),
  identity: z.catch(z.nullable(kLaunchIdentitySchema), null),
  preferences: z.catch(z.record(z.string(), kOverridesSchema), {}),
  ports: z.catch(kLaunchPortsSchema, {})
});
const kShellMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("jolly-appearance"),
    appearance: kAppearanceSchema
  }),
  z.object({
    type: z.literal("jolly-preferences"),
    scope: z.string(),
    overrides: kOverridesSchema
  }),
  z.object({
    type: z.literal("jolly-session-renewed")
  }),
  z.object({
    type: z.literal("jolly-reveal"),
    key: z.string()
  })
]);

export type FrameMessage = z.output<typeof kFrameMessageSchema>;
export type ShellMessage = z.output<typeof kShellMessageSchema>;

export type NotificationMessage = Extract<FrameMessage, {
  type:
    | "jolly-notification"
    | "jolly-notification-update"
    | "jolly-notification-dismiss";
}>;
export type ShellCommand = Exclude<
  FrameMessage,
  NotificationMessage | { type: "jolly-ready"; }
>;

export type LaunchMessage = z.output<typeof kLaunchMessageSchema>;
export type LaunchIdentity = z.output<typeof kLaunchIdentitySchema>;
export type LaunchPorts = z.output<typeof kLaunchPortsSchema>;

export function parseFrameMessage(
  data: unknown
): FrameMessage | undefined {
  const parsed = kFrameMessageSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}

export function parseLaunchMessage(
  data: unknown
): LaunchMessage | undefined {
  const parsed = kLaunchMessageSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}

export function parseShellMessage(
  data: unknown
): ShellMessage | undefined {
  const parsed = kShellMessageSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}
