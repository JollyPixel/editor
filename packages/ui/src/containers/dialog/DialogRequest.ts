export interface DialogRequestHost {
  readonly updateComplete: Promise<boolean>;
}

export interface RequestedDialog extends EventTarget {
  showModal(): Promise<void>;
  close(returnValue?: string): void;
}

export interface DialogRequestOptions {
  dialog: () => RequestedDialog;
  focus?: () => HTMLElement | null;
}

export class DialogRequest<TResult> {
  #host: DialogRequestHost;
  #dialog: () => RequestedDialog;
  #focus: () => HTMLElement | null;
  #settle: ((result: TResult | null) => void) | null = null;

  get pending(): boolean {
    return this.#settle !== null;
  }

  constructor(
    host: DialogRequestHost,
    options: DialogRequestOptions
  ) {
    this.#host = host;
    this.#dialog = options.dialog;
    this.#focus = options.focus ?? (() => null);
  }

  async open(): Promise<TResult | null> {
    this.#finish(null);
    const {
      promise,
      resolve
    } = Promise.withResolvers<TResult | null>();
    this.#settle = resolve;

    await this.#host.updateComplete;
    if (this.#settle !== resolve) {
      return promise;
    }

    const dialog = this.#dialog();
    dialog.addEventListener("jolly-close", this.#onClose);
    await dialog.showModal();
    this.#focus()?.focus();

    return promise;
  }

  confirm(
    result: TResult,
    returnValue = "confirm"
  ): void {
    this.#finish(result);
    this.#dialog().close(returnValue);
  }

  cancel(): void {
    this.#finish(null);
    this.#dialog().close("cancel");
  }

  #finish(
    result: TResult | null
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    settle?.(result);
  }

  #onClose = (
    event: Event
  ): void => {
    if (event.target === event.currentTarget) {
      this.#finish(null);
    }
  };
}
