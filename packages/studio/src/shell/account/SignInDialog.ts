// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import {
  AccountsRequestError,
  InvalidPasswordError,
  InvalidUsernameError,
  MIN_PASSWORD_LENGTH,
  type Account,
  type AccountsClient,
  type AccountsFailureCode
} from "@jolly-pixel/accounts";
import type { Dialog } from "@jolly-pixel/ui";

// CONSTANTS
const kRequestMessages: Partial<Record<AccountsFailureCode, string>> = {
  "invalid-credentials": "Wrong username or password.",
  "username-taken": "This username is taken.",
  "master-password-required": "This studio asks for its master password.",
  "invalid-master-password": "Wrong master password.",
  "account-pending": "Your access request awaits an admin's approval.",
  "access-requests-full": "Too many access requests await approval. Try again later.",
  throttled: "Too many failed attempts. Try again later."
};
const kMasterPasswordCodes = new Set<AccountsFailureCode>([
  "master-password-required",
  "invalid-master-password"
]);
const kRequestSent = "Request sent. Sign in once an admin approves it.";

export type SignInMode = "login" | "register";

@customElement("studio-sign-in")
export class SignInDialog extends LitElement {
  @state()
  declare _mode: SignInMode;

  @state()
  declare _error: string | null;

  @state()
  declare _notice: string | null;

  @state()
  declare _pending: boolean;

  @state()
  declare _masterPasswordAsked: boolean;

  @query("jolly-dialog")
  declare _dialog: Dialog;

  @query("input[name=username]")
  declare _username: HTMLInputElement;

  @query("input[name=password]")
  declare _password: HTMLInputElement;

  @query("input[name=master-password]")
  declare _masterPassword: HTMLInputElement | null;

  #accounts: AccountsClient | null = null;
  #settle: ((signedIn: Account) => void) | null = null;

  constructor() {
    super();
    this._mode = "login";
    this._error = null;
    this._notice = null;
    this._pending = false;
    this._masterPasswordAsked = false;
  }

  async open(
    accounts: AccountsClient
  ): Promise<Account> {
    this.#accounts = accounts;
    this._error = globalThis.crypto?.subtle === undefined ?
      "Signing in needs HTTPS or localhost." :
      null;

    const {
      promise,
      resolve
    } = Promise.withResolvers<Account>();
    this.#settle = resolve;

    await this.updateComplete;
    await this._dialog.showModal();
    this._username.focus();

    return promise;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    const register = this._mode === "register";

    return html`
      <jolly-dialog
        heading=${register ? "Create an account" : "Sign in"}
        .dismissible=${false}
      >
        <form
          id="sign-in-form"
          class="sign-in-form"
          @submit=${this.#onSubmit}
          @keydown=${this.#onKeyDown}
        >
          <label>
            <span>Username</span>
            <input
              name="username"
              autocomplete="username"
              required
              ?disabled=${this._pending}
            >
          </label>
          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autocomplete=${register ? "new-password" : "current-password"}
              minlength=${register ? MIN_PASSWORD_LENGTH : nothing}
              required
              ?disabled=${this._pending}
            >
          </label>
          ${register && this._masterPasswordAsked ? html`
            <label>
              <span>Master password</span>
              <input
                name="master-password"
                type="password"
                autocomplete="off"
                required
                ?disabled=${this._pending}
              >
            </label>
          ` : nothing}
          ${register && !this._masterPasswordAsked ? html`
            <button
              type="button"
              class="sign-in-link"
              ?disabled=${this._pending}
              @click=${this.#askMasterPassword}
            >I have the master password</button>
          ` : nothing}
          ${this._notice === null ? nothing : html`
            <p class="sign-in-notice" role="status">${this._notice}</p>
          `}
          ${this._error === null ? nothing : html`
            <p class="sign-in-error" role="alert">${this._error}</p>
          `}
        </form>
        <jolly-button
          slot="actions"
          data-action="switch"
          ?disabled=${this._pending}
          @click=${this.#switchMode}
        >${register ? "I have an account" : "Create an account"}</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          data-action="submit"
          ?disabled=${this._pending}
          @click=${this.#submit}
        >${register ? "Create account" : "Sign in"}</jolly-button>
      </jolly-dialog>
    `;
  }

  #switchMode(): void {
    this._mode = this._mode === "login" ? "register" : "login";
    this._error = null;
    this._notice = null;
  }

  async #askMasterPassword(): Promise<void> {
    this._masterPasswordAsked = true;
    await this.updateComplete;
    this._masterPassword?.focus();
  }

  #onSubmit(
    event: SubmitEvent
  ): void {
    event.preventDefault();
    void this.#submit();
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void this.#submit();
    }
  }

  async #submit(): Promise<void> {
    const accounts = this.#accounts;
    if (accounts === null || this._pending) {
      return;
    }
    const fields = [
      this._username,
      this._password,
      this._masterPassword
    ];
    if (!fields.every((field) => field?.reportValidity() ?? true)) {
      return;
    }

    this._pending = true;
    this._error = null;
    this._notice = null;
    let masterPasswordRefused = false;
    try {
      const username = this._username.value;
      const password = this._password.value;
      if (this._mode === "register") {
        await this.#register(accounts, username, password);
      }
      else {
        this.#resolve(await accounts.login(username, password));
      }
    }
    catch (error) {
      if (isPending(error)) {
        this._notice = messageFor(error);
      }
      else {
        this._error = messageFor(error);
      }
      masterPasswordRefused = error instanceof AccountsRequestError &&
        kMasterPasswordCodes.has(error.code);
    }
    finally {
      this._pending = false;
    }

    if (masterPasswordRefused) {
      this._masterPasswordAsked = true;
      await this.updateComplete;
      this._masterPassword?.select();
    }
  }

  async #register(
    accounts: AccountsClient,
    username: string,
    password: string
  ): Promise<void> {
    const registration = await accounts.register(username, password, {
      masterPassword: this._masterPassword?.value
    });
    if (registration.status === "active") {
      this.#resolve(registration.account);
    }
    else {
      this._mode = "login";
      this._notice = kRequestSent;
    }
  }

  #resolve(
    signedIn: Account
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    this.#accounts = null;
    this._dialog.close("confirm");
    settle?.(signedIn);
  }
}

function isPending(
  error: unknown
): boolean {
  return error instanceof AccountsRequestError &&
    error.code === "account-pending";
}

function messageFor(
  error: unknown
): string {
  if (error instanceof AccountsRequestError) {
    return kRequestMessages[error.code] ?? capitalize(error.message);
  }
  if (
    error instanceof InvalidUsernameError ||
    error instanceof InvalidPasswordError
  ) {
    return `${capitalize(error.message)}.`;
  }

  return "The studio could not be reached.";
}

function capitalize(
  message: string
): string {
  return message.charAt(0).toUpperCase() + message.slice(1);
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-sign-in": SignInDialog;
  }
}
