// Import Third-party Dependencies
import {
  Button,
  Checkbox,
  Dialog,
  Text,
  detailOf,
  type ButtonVariant,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

export interface NewNamedEntityResult {
  name: string;
  addAsChild: boolean;
}

export interface PromptNewNamedEntityOptions {
  heading: string;
  fieldLabel: string;
  defaultName: string;
  /** Whether a selection exists that the new entity could nest under. */
  offerAddAsChild: boolean;
}

/** Shared by `promptNewBlock` and `promptNewFolder`, which only differ in wording. */
export function promptNewNamedEntity(
  options: PromptNewNamedEntityOptions
): Promise<NewNamedEntityResult | null> {
  const { heading, fieldLabel, defaultName, offerAddAsChild } = options;
  const dialog = new Dialog();
  dialog.heading = heading;

  let name = defaultName;
  const nameField = new Text();
  nameField.label = fieldLabel;
  nameField.value = name;
  nameField.addEventListener("jolly-input", captureName);
  nameField.addEventListener("jolly-change", captureName);
  dialog.append(nameField);

  let addAsChild = true;
  if (offerAddAsChild) {
    const addAsChildField = new Checkbox();
    addAsChildField.label = "Add as child of selection";
    addAsChildField.value = true;
    addAsChildField.addEventListener("jolly-change", captureAddAsChild);
    dialog.append(addAsChildField);
  }

  const confirm = actionButton("OK", "confirm", "accent");
  const cancel = actionButton("Cancel", "cancel", "default");
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);
  document.body.append(dialog);

  return settlePrompt(dialog, resolveResult, nameField);

  function captureName(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      name = detail.value;
    }
  }

  function captureAddAsChild(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<boolean>>(event);
    if (detail !== null) {
      addAsChild = detail.value;
    }
  }

  function resolveResult(
    returnValue: string
  ): NewNamedEntityResult | null {
    if (returnValue !== "confirm") {
      return null;
    }

    return {
      name: name.trim(),
      addAsChild: offerAddAsChild && addAsChild
    };
  }
}

export function actionButton(
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

export function settlePrompt<TResult>(
  dialog: Dialog,
  resolveValue: (returnValue: string) => TResult,
  focusOnOpen?: HTMLElement
): Promise<TResult> {
  const { promise, resolve } = Promise.withResolvers<TResult>();
  let settled = false;

  function settle(
    returnValue: string
  ): void {
    if (settled) {
      return;
    }

    settled = true;
    dialog.remove();
    resolve(resolveValue(returnValue));
  }

  dialog.addEventListener("jolly-cancel", () => settle(""));
  dialog.addEventListener("jolly-close", (event) => {
    const detail = detailOf<{ returnValue: string; }>(event);
    if (detail !== null) {
      settle(detail.returnValue);
    }
  });
  void dialog.showModal().then(() => focusOnOpen?.focus());

  return promise;
}
