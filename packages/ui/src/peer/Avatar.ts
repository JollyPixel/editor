// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import { colorFromKey } from "@jolly-pixel/color";

// Import Internal Dependencies
import { defaultAvatarIcon } from "./avatarIcons.ts";
import "../icon/Icon.ts";

export interface PeerAvatar {
  /**
   * Picks the default glyph and its color.
   */
  peerId: string;
  /**
   * CSS color of the default glyph. Defaults to the peer color.
   */
  color?: string;
  /**
   * Image URL drawn in place of the glyph. The glyph comes back when the
   * image fails to load.
   */
  image?: string;
  /**
   * Draws a status dot in the bottom corner. Omitted, no dot.
   */
  presence?: PeerPresence;
}

export type PeerPresence = "online" | "offline";

// CONSTANTS
const kPresenceLabels: Record<PeerPresence, string> = {
  online: "Online",
  offline: "Offline"
};

@customElement("jolly-avatar")
export class Avatar extends LitElement {
  static override styles = css`
    :host {
      position: relative;
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      width: var(--jolly-avatar-size, 16px);
      height: var(--jolly-avatar-size, 16px);
    }

    jolly-icon {
      --jolly-icon-size: 100%;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: var(--jolly-avatar-radius, 25%);
      object-fit: cover;
    }

    :host([presence="offline"]) img,
    :host([presence="offline"]) jolly-icon {
      opacity: 0.5;
      filter: grayscale(1);
    }

    .presence {
      position: absolute;
      inset-block-end: -1px;
      inset-inline-end: -1px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      box-shadow: 0 0 0 1px var(--jolly-avatar-presence-ring, var(--jolly-surface, Canvas));
      background: var(--jolly-success, oklch(62% 0.150 149deg));
    }

    :host([presence="offline"]) .presence {
      background: var(--jolly-text-muted, GrayText);
    }
  `;

  @property({ type: String, attribute: "peer-id" })
  declare peerId: string;

  @property({ type: String })
  declare color: string;

  @property({ type: String })
  declare image: string;

  @property({ type: String, reflect: true })
  declare presence: PeerPresence | "";

  @state()
  declare _broken: boolean;

  constructor() {
    super();

    this.peerId = "";
    this.color = "";
    this.image = "";
    this.presence = "";
    this._broken = false;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("image")) {
      this._broken = false;
    }
    if (changed.has("presence")) {
      this.#announcePresence();
    }
  }

  override render(): TemplateResult {
    return html`
      ${this.#renderFace()}
      ${this.presence === "" ? nothing : html`
        <span class="presence" part="presence"></span>
      `}
    `;
  }

  #renderFace(): TemplateResult {
    if (this.image !== "" && !this._broken) {
      return html`
        <img
          part="image"
          src=${this.image}
          alt=""
          draggable="false"
          @error=${this.#onError}
        />
      `;
    }

    return html`
      <jolly-icon
        part="glyph"
        name=${defaultAvatarIcon(this.peerId)}
        style=${`color: ${this.color || colorFromKey(this.peerId)}`}
      ></jolly-icon>
    `;
  }

  #announcePresence(): void {
    if (this.presence === "") {
      this.setAttribute("aria-hidden", "true");
      this.removeAttribute("role");
      this.removeAttribute("aria-label");
      this.removeAttribute("title");

      return;
    }

    const label = kPresenceLabels[this.presence];
    this.removeAttribute("aria-hidden");
    this.setAttribute("role", "img");
    this.setAttribute("aria-label", label);
    this.setAttribute("title", label);
  }

  readonly #onError = (): void => {
    this._broken = true;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-avatar": Avatar;
  }
}
