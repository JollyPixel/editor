// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
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
}

@customElement("jolly-avatar")
export class Avatar extends LitElement {
  static override styles = css`
    :host {
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
  `;

  @property({ type: String, attribute: "peer-id" })
  declare peerId: string;

  @property({ type: String })
  declare color: string;

  @property({ type: String })
  declare image: string;

  @state()
  declare _broken: boolean;

  constructor() {
    super();

    this.peerId = "";
    this.color = "";
    this.image = "";
    this._broken = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("image")) {
      this._broken = false;
    }
  }

  override render(): TemplateResult {
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

  readonly #onError = (): void => {
    this._broken = true;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-avatar": Avatar;
  }
}
