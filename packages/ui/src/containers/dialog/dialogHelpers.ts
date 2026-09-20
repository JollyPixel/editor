// Import Internal Dependencies
import { Dialog } from "./Dialog.ts";
import type { DialogIntent } from "./dialogHeader.ts";
import {
  Button,
  type ButtonVariant
} from "../../controls/Button.ts";
import { Text } from "../../controls/Text.ts";
import { detailOf } from "../../dom.ts";
import type {
  IconName,
  IconTone
} from "../../icon/registry.ts";
import { defaultStorageAdapter } from "../../storage/defaultStorage.ts";
import type { JollyChangeDetail } from "../../field/events.ts";
import type { StorageAdapter } from "../../storage/StorageAdapter.ts";

export interface DialogHeaderOptions {
  title?: string;
  icon?: IconName;
  tone?: IconTone;
  intent?: DialogIntent;
}

export interface PromptOptions extends DialogHeaderOptions {
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmOptions extends DialogHeaderOptions {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ChoiceAction<TValue extends string = string> {
  value: TValue;
  label: string;
  variant?: ButtonVariant;
}

export interface ChoiceOptions<TValue extends string = string>
  extends DialogHeaderOptions {
  message: string;
  content?: readonly Node[];
  actions: readonly ChoiceAction<TValue>[];
  cancelLabel?: string;
  focus?: TValue;
}

export interface StoredPromptOptions extends PromptOptions {
  storage?: StorageAdapter;
  storageKey: string;
  fallbackValue: string;
}

export function showPrompt({
  label,
  defaultValue = "",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  ...header
}: PromptOptions): Promise<string | null> {
  const dialog = headedDialog(header);

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

export async function showConfirm({
  title = "",
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  danger = false,
  intent = danger ? "danger" : undefined,
  ...header
}: ConfirmOptions): Promise<boolean> {
  const choice = await showChoice({
    ...header,
    title,
    intent,
    message,
    cancelLabel,
    actions: [
      {
        value: "confirm",
        label: confirmLabel,
        variant: danger ? "danger" : "accent"
      }
    ],
    focus: "confirm"
  });

  return choice !== null;
}

export function showChoice<TValue extends string>({
  message,
  content = [],
  actions,
  cancelLabel = "Cancel",
  focus,
  ...header
}: ChoiceOptions<TValue>): Promise<TValue | null> {
  const dialog = headedDialog(header);

  const text = document.createElement("p");
  text.textContent = message;
  dialog.append(text, ...content);

  const cancel = actionButton(
    cancelLabel,
    "cancel",
    "default"
  );
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel);

  let focused: HTMLElement | undefined;
  for (const action of actions) {
    const button = actionButton(
      action.label,
      action.value,
      action.variant ?? "default"
    );
    button.addEventListener("click", () => dialog.close(action.value));
    dialog.append(button);
    if (action.value === focus) {
      focused = button;
    }
  }
  document.body.append(dialog);

  return settleHelper(
    dialog,
    (returnValue) => actions.find((action) => action.value === returnValue)?.value ?? null,
    focused
  );
}

export async function resolveStoredPrompt({
  storage = defaultStorageAdapter(),
  storageKey,
  fallbackValue,
  ...promptOptions
}: StoredPromptOptions): Promise<string> {
  const stored = storage.get(storageKey)?.trim();
  if (stored) {
    return stored;
  }

  const prompted = await showPrompt(promptOptions);
  const value = prompted === null || prompted === "" ?
    fallbackValue :
    prompted;
  storage.set(storageKey, value);

  return value;
}

function headedDialog(
  header: DialogHeaderOptions
): Dialog {
  const dialog = new Dialog();
  dialog.heading = header.title ?? "";
  dialog.icon = header.icon ?? "";
  dialog.tone = header.tone ?? "";
  dialog.intent = header.intent ?? "";

  return dialog;
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

function removeAfterExit(
  dialog: Dialog
): void {
  if (dialog.open) {
    dialog.addEventListener(
      "jolly-close",
      () => removeAfterExit(dialog),
      { once: true }
    );

    return;
  }

  const exits = dialog._dialog?.getAnimations?.({ subtree: true }) ?? [];
  void Promise.allSettled(exits.map((animation) => animation.finished))
    .then(() => dialog.remove());
}

function settleHelper<TResult>(
  dialog: Dialog,
  resolveValue: (returnValue: string) => TResult,
  focusOnOpen?: HTMLElement
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
    removeAfterExit(dialog);
    resolve(resolveValue(returnValue));
  }

  dialog.addEventListener("jolly-close", (event) => {
    const detail = detailOf<{ returnValue: string; }>(event);
    if (detail !== null) {
      settle(detail.returnValue);
    }
  });
  void dialog.showModal().then(() => focusOnOpen?.focus());

  return promise;
}
