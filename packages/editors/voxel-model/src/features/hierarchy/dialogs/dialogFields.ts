// Import Third-party Dependencies
import {
  Button,
  Checkbox,
  detailOf,
  type ButtonVariant,
  type Dialog,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

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

export function appendConfirmActions(
  dialog: Dialog,
  confirmLabel: string,
  variant: ButtonVariant
): { confirm: Button; cancel: Button; } {
  const confirm = actionButton(confirmLabel, "confirm", variant);
  const cancel = actionButton("Cancel", "cancel", "default");
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);

  return { confirm, cancel };
}

export function checkboxField(
  label: string,
  initialValue: boolean,
  onChange: (value: boolean) => void
): Checkbox {
  const field = new Checkbox();
  field.label = label;
  field.value = initialValue;
  field.addEventListener("jolly-change", (event: Event) => {
    const detail = detailOf<JollyChangeDetail<boolean>>(event);
    if (detail !== null) {
      onChange(detail.value);
    }
  });

  return field;
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
  document.body.append(dialog);
  void dialog.showModal().then(() => focusOnOpen?.focus());

  return promise;
}
