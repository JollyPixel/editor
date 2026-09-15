// Import Third-party Dependencies
import {
  Button,
  Dialog,
  detailOf,
  type ButtonVariant
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
