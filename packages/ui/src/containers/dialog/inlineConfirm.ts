// Import Internal Dependencies
import type { ButtonVariant } from "../../controls/Button.ts";

export interface InlineConfirmOptions {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface InlineConfirmation {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  variant: ButtonVariant;
}

export function resolveInlineConfirmation(
  options: InlineConfirmOptions
): InlineConfirmation {
  const {
    message,
    confirmLabel = "OK",
    cancelLabel = "Cancel",
    danger = false
  } = options;

  return {
    message,
    confirmLabel,
    cancelLabel,
    danger,
    variant: danger ? "danger" : "accent"
  };
}
