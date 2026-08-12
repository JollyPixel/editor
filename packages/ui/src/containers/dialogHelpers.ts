// Import Internal Dependencies
import { Dialog } from "./Dialog.ts";
import {
  Button,
  type ButtonVariant
} from "../controls/Button.ts";
import { Text } from "../controls/Text.ts";
import { detailOf } from "../dom.ts";
import type { JollyChangeDetail } from "../field/events.ts";

export interface PromptOptions {
  title?: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function showPrompt({
  title = "",
  label,
  defaultValue = "",
  confirmLabel = "OK",
  cancelLabel = "Cancel"
}: PromptOptions): Promise<string | null> {
  const dialog = new Dialog();
  dialog.heading = title;

  let value = defaultValue;
  const field = new Text();
  field.label = label;
  field.value = value;
  field.addEventListener("jolly-input", captureValue);
  field.addEventListener("jolly-change", captureValue);
  dialog.append(field);

  const confirm = actionButton(
    confirmLabel,
    "confirm",
    "accent"
  );
  const cancel = actionButton(
    cancelLabel,
    "cancel",
    "default"
  );
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);
  document.body.append(dialog);

  return settleHelper(dialog, resolvePrompt);

  function captureValue(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      value = detail.value;
    }
  }

  function resolvePrompt(
    returnValue: string
  ): string | null {
    return returnValue === "confirm" ? value.trim() : null;
  }
}

export function showConfirm({
  title = "",
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  danger = false
}: ConfirmOptions): Promise<boolean> {
  const dialog = new Dialog();
  dialog.heading = title;

  const content = document.createElement("p");
  content.textContent = message;
  dialog.append(content);

  const confirm = actionButton(
    confirmLabel,
    "confirm",
    danger ? "danger" : "accent"
  );
  const cancel = actionButton(
    cancelLabel,
    "cancel",
    "default"
  );
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);
  document.body.append(dialog);

  return settleHelper(
    dialog,
    (returnValue) => returnValue === "confirm"
  );
}

function actionButton(
  label: string,
  action: string,
  variant: ButtonVariant
): Button {
  const button = new Button();
  button.slot = "actions";
  button.variant = variant;
  button.dataset.action = action;
  button.textContent = label;

  return button;
}

function settleHelper<TResult>(
  dialog: Dialog,
  resolveValue: (returnValue: string) => TResult
): Promise<TResult> {
  const {
    promise,
    resolve
  } = Promise.withResolvers<TResult>();
  let settled = false;

  function settle(
    returnValue: string
  ): void {
    if (settled) {
      return;
    }

    settled = true;
    resolve(resolveValue(returnValue));
    dialog.remove();
  }

  dialog.addEventListener("jolly-cancel", () => settle(""));
  dialog.addEventListener("jolly-close", (event) => {
    const detail = detailOf<{ returnValue: string; }>(event);
    if (detail !== null) {
      settle(detail.returnValue);
    }
  });
  void dialog.showModal();

  return promise;
}
