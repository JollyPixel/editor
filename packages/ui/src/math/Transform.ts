// Import Third-party Dependencies
import {
  LitElement,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import type { FieldValue } from "../field/mixed.ts";
import { emitFieldEvent } from "../field/events.ts";
import { detailOf } from "../dom.ts";
import type { CollaboratorPresence } from "../peer/types.ts";
import type { QuatLike, VectorValue } from "./types.ts";
import { transformStyles } from "./Transform.styles.ts";
import type { FieldLabelPosition } from "../field/JollyField.ts";

// Registers the sub-rows.
import "./Vector3.ts";
import "./Quaternion.ts";

type TransformAxis3 = "x" | "y" | "z";
type TransformSubKey = "position" | "rotation" | "scale";

export interface TransformValue {
  position: VectorValue<TransformAxis3>;
  rotation: FieldValue<QuatLike>;
  scale: VectorValue<TransformAxis3>;
}

export interface TransformDefault {
  position?: Record<TransformAxis3, number>;
  rotation?: QuatLike;
  scale?: Record<TransformAxis3, number>;
}

/** State applied independently to one transform sub-field. */
export interface TransformSubFieldState {
  lockedBy?: CollaboratorPresence | null;
  peers?: CollaboratorPresence[];
  disabled?: boolean;
  readonly?: boolean;
  error?: string | null;
}

export interface TransformFieldState {
  position?: TransformSubFieldState;
  rotation?: TransformSubFieldState;
  scale?: TransformSubFieldState;
}

// CONSTANTS
const kEmptySubState: TransformSubFieldState = {};

/**
 * Composes independently labeled and lockable position, rotation and scale
 * fields. Each sub-field owns its Mixed and revert state.
 */
@customElement("jolly-transform")
export class Transform extends LitElement {
  static override styles = [
    transformStyles
  ];

  @property({ attribute: false })
  declare value: TransformValue;

  @property({ attribute: false })
  declare default: TransformDefault | undefined;

  @property({ attribute: false })
  declare state: TransformFieldState;

  @property({
    type: String,
    attribute: "position-label"
  })
  declare positionLabel: string;

  @property({
    type: String,
    attribute: "rotation-label"
  })
  declare rotationLabel: string;

  @property({
    type: String,
    attribute: "scale-label"
  })
  declare scaleLabel: string;

  /** Forwarded to the position, rotation and scale sub-fields. */
  @property({
    type: String,
    attribute: "label-position",
    reflect: true
  })
  declare labelPosition: FieldLabelPosition;

  constructor() {
    super();

    this.value = {
      position: {
        x: 0,
        y: 0,
        z: 0
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
        w: 1
      },
      scale: {
        x: 1,
        y: 1,
        z: 1
      }
    };
    this.default = undefined;
    this.state = {};
    this.positionLabel = "Position";
    this.rotationLabel = "Rotation";
    this.scaleLabel = "Scale";
    this.labelPosition = "inline";
  }

  /**
   * Aligns the three label columns when their labels change. A top label
   * position puts each label above its own value, so the shared column is
   * moot.
   */
  protected override willUpdate(
    changed: PropertyValues
  ): void {
    if (
      this.labelPosition === "inline" &&
      (
        changed.has("positionLabel") ||
        changed.has("rotationLabel") ||
        changed.has("scaleLabel") ||
        changed.has("labelPosition")
      )
    ) {
      const width = Math.max(
        this.positionLabel.length,
        this.rotationLabel.length,
        this.scaleLabel.length
      );
      this.style.setProperty("--jolly-label-width", `${width}ch`);
    }
    else if (changed.has("labelPosition") && this.labelPosition === "top") {
      this.style.removeProperty("--jolly-label-width");
    }
  }

  override render(): TemplateResult {
    const position = this.state.position ?? kEmptySubState;
    const rotation = this.state.rotation ?? kEmptySubState;
    const scale = this.state.scale ?? kEmptySubState;

    return html`
      <jolly-vector3
        label=${this.positionLabel}
        label-position=${this.labelPosition}
        .value=${this.value.position}
        .default=${this.default?.position}
        .lockedBy=${position.lockedBy ?? null}
        .peers=${position.peers ?? []}
        .error=${position.error ?? null}
        ?disabled=${position.disabled ?? false}
        ?readonly=${position.readonly ?? false}
        @jolly-input=${(event: Event) => this.#relay("position", event, true)}
        @jolly-change=${(event: Event) => this.#relay("position", event, false)}
      ></jolly-vector3>
      <jolly-quaternion
        label=${this.rotationLabel}
        label-position=${this.labelPosition}
        .value=${this.value.rotation}
        .default=${this.default?.rotation}
        .lockedBy=${rotation.lockedBy ?? null}
        .peers=${rotation.peers ?? []}
        .error=${rotation.error ?? null}
        ?disabled=${rotation.disabled ?? false}
        ?readonly=${rotation.readonly ?? false}
        @jolly-input=${(event: Event) => this.#relay("rotation", event, true)}
        @jolly-change=${(event: Event) => this.#relay("rotation", event, false)}
      ></jolly-quaternion>
      <jolly-vector3
        label=${this.scaleLabel}
        label-position=${this.labelPosition}
        .value=${this.value.scale}
        .default=${this.default?.scale}
        .lockedBy=${scale.lockedBy ?? null}
        .peers=${scale.peers ?? []}
        .error=${scale.error ?? null}
        ?disabled=${scale.disabled ?? false}
        ?readonly=${scale.readonly ?? false}
        @jolly-input=${(event: Event) => this.#relay("scale", event, true)}
        @jolly-change=${(event: Event) => this.#relay("scale", event, false)}
      ></jolly-vector3>
    `;
  }

  /** Merges a sub-field commit into the complete TransformValue. */
  #relay(
    key: TransformSubKey,
    event: Event,
    live: boolean
  ): void {
    const detail = detailOf<{ value: unknown; }>(event);
    if (detail === null) {
      return;
    }

    const next: TransformValue = {
      ...this.value,
      [key]: detail.value
    };

    emitFieldEvent(
      this,
      live ? "jolly-input" : "jolly-change",
      next
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-transform": Transform;
  }
}
