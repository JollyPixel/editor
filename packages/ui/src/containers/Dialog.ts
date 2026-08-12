// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { dialogStyles } from "./Dialog.styles.ts";
import { emitContainerEvent } from "./events.ts";
import { themeStyles } from "../theme/themeStyles.ts";
import { resolveThemeToken } from "../theme/resolveThemeToken.ts";
import type { ThemeMode } from "../theme/types.ts";

type ResolvedThemeMode = Exclude<ThemeMode, "auto">;

@customElement("jolly-dialog")
export class Dialog extends LitElement {
  static override styles = [
    themeStyles,
    dialogStyles
  ];

  @property({ type: String })
  declare heading: string;

  @property({ type: Boolean })
  declare dismissible: boolean;

  @query("dialog")
  declare _dialog: HTMLDialogElement;

  #inheritedTheme: ResolvedThemeMode | null = null;

  constructor() {
    super();

    this.heading = "";
    this.dismissible = true;
  }

  get open(): boolean {
    return this._dialog?.open ?? false;
  }

  override render(): TemplateResult {
    return html`
      <dialog
        @cancel=${this.#onCancel}
        @click=${this.#onBackdropClick}
        @close=${this.#onClose}
      >
        ${this.heading === "" ? nothing : html`<header>${this.heading}</header>`}
        <div class="body"><slot></slot></div>
        <footer><slot name="actions"></slot></footer>
      </dialog>
    `;
  }

  async showModal(): Promise<void> {
    this.#syncInheritedTheme();
    await this.updateComplete;
    if (!this._dialog.open) {
      this._dialog.showModal();
    }
  }

  close(
    returnValue = ""
  ): void {
    if (this._dialog?.open) {
      this._dialog.close(returnValue);
    }
  }

  /**
   * A helper dialog may live under document.body while its invoking control
   * sits in a themed shadow root. Declarative dialogs prefer their parent.
   */
  #syncInheritedTheme(): void {
    const configured = this.getAttribute("theme");
    if (
      configured !== null &&
      configured !== this.#inheritedTheme
    ) {
      return;
    }

    const inherited = inheritedThemeMode(this);
    if (inherited === null) {
      return;
    }

    this.#inheritedTheme = inherited;
    this.setAttribute("theme", inherited);
  }

  #onCancel = (
    event: Event
  ) => {
    if (!this.dismissible) {
      event.preventDefault();

      return;
    }

    emitContainerEvent(
      this,
      "jolly-cancel",
      undefined
    );
  };

  #onBackdropClick = (
    event: MouseEvent
  ) => {
    if (
      !this.dismissible ||
      event.target !== this._dialog
    ) {
      return;
    }

    const rect = this._dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) {
      emitContainerEvent(
        this,
        "jolly-cancel",
        undefined
      );
      this.close();
    }
  };

  #onClose = () => {
    emitContainerEvent(this, "jolly-close", {
      returnValue: this._dialog.returnValue
    });
  };
}

function inheritedThemeMode(
  dialog: Dialog
): ResolvedThemeMode | null {
  const parent = dialog.parentElement;
  if (parent !== null) {
    const parentStyle = getComputedStyle(parent);
    const carriesTheme = resolveThemeToken(parent, "--jolly-surface") !== "";
    if (carriesTheme) {
      const mode = themeModeOf(parentStyle);
      if (mode !== null) {
        return mode;
      }
    }
  }

  const active = dialog.ownerDocument.activeElement;
  if (active !== null) {
    const mode = themeModeOf(getComputedStyle(active));
    if (mode !== null) {
      return mode;
    }
  }

  return parent === null
    ? null
    : themeModeOf(getComputedStyle(parent));
}

function themeModeOf(
  style: CSSStyleDeclaration
): ResolvedThemeMode | null {
  const schemes = new Set(
    style.colorScheme.split(/\s+/)
  );
  const hasLight = schemes.has("light");
  const hasDark = schemes.has("dark");

  if (hasDark && !hasLight) {
    return "dark";
  }
  if (hasLight && !hasDark) {
    return "light";
  }

  return null;
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-dialog": Dialog;
  }
}
