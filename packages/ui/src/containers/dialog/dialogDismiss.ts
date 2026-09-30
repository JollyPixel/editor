export interface DismissibleDialog {
  readonly dismissible: boolean;
  settleConfirmation(confirmed: false): void;
  cancel(): void;
  close(): void;
}

export function dismissDialog(
  dialog: DismissibleDialog
): boolean {
  if (!dialog.dismissible) {
    return false;
  }

  dialog.settleConfirmation(false);
  dialog.cancel();
  dialog.close();

  return true;
}
