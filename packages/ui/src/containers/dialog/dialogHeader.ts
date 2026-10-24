// Import Internal Dependencies
import {
  iconTone,
  isIconTone,
  type IconName,
  type IconTone
} from "../../icon/registry.ts";

// CONSTANTS
export const DIALOG_INTENTS = [
  "info",
  "success",
  "warning",
  "danger"
] as const;
const kIntentIcons: Record<DialogIntent, IconName> = {
  info: "info",
  success: "check",
  warning: "warning",
  danger: "warning"
};
const kAlertIntents: ReadonlySet<DialogIntent> = new Set([
  "warning",
  "danger"
]);

export type DialogIntent = typeof DIALOG_INTENTS[number];

export interface DialogHeaderSource {
  icon: IconName;
  tone: string;
  intent: string;
  paneTone: IconTone | null;
}

export interface DialogHeader {
  icon: IconName;
  intent: DialogIntent | null;
  tone: IconTone | null;
  alert: boolean;
}

export function isDialogIntent(
  value: string
): value is DialogIntent {
  return DIALOG_INTENTS.some((intent) => intent === value);
}

export function resolveDialogHeader(
  options: DialogHeaderSource
): DialogHeader {
  const {
    icon,
    tone,
    intent,
    paneTone
  } = options;

  if (!isDialogIntent(intent)) {
    return {
      icon,
      intent: null,
      tone: isIconTone(tone) ? tone : paneTone ?? iconTone(icon),
      alert: false
    };
  }

  return {
    icon: icon === "" ? kIntentIcons[intent] : icon,
    intent,
    tone: null,
    alert: kAlertIntents.has(intent)
  };
}
