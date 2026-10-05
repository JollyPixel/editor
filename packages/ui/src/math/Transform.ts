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
import type {
  AxisStyle,
  QuatLike,
  VectorValue
} from "./types.ts";
import { transformStyles } from "./Transform.styles.ts";
import {
  DEFAULT_STACK_BELOW,
  LabelStackController,
  type FieldLabelPosition
} from "../field/LabelStackController.ts";
import { Vector3 } from "./Vector3.ts";
import { Quaternion } from "./Quaternion.ts";

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
const kNoPeers: CollaboratorPresence[] = [];

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

  @property({
    type: String,
    attribute: "label-position",
    reflect: true
  })
  declare labelPosition: FieldLabelPosition;

  @property({
    type: Number,
    attribute: "stack-below"
  })
  declare stackBelow: number;

  @property({
    type: String,
    attribute: "axis-style"
  })
  declare axisStyle: AxisStyle | undefined;

  #stack = new LabelStackController(this);

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
    this.stackBelow = DEFAULT_STACK_BELOW;
    this.axisStyle = undefined;
  }

  protected override willUpdate(
    changed: PropertyValues
  ): void {
    if (
      this.labelPosition !== "top" &&
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
    const labelPosition = this.#stack.stacked ? "top" : "inline";
    const position = this.state.position ?? kEmptySubState;
    const rotation = this.state.rotation ?? kEmptySubState;
    const scale = this.state.scale ?? kEmptySubState;
    const vectorAxisStyle = this.axisStyle ?? Vector3.Defaults.axisStyle;
    const rotationAxisStyle = this.axisStyle ??
      Quaternion.Defaults.axisStyle;

    return html`
      <jolly-vector3
        label=${this.positionLabel}
        label-position=${labelPosition}
        axis-style=${vectorAxisStyle}
        .value=${this.value.position}
        .default=${this.default?.position}
        .lockedBy=${position.lockedBy ?? null}
        .peers=${position.peers ?? kNoPeers}
        .error=${position.error ?? null}
        ?disabled=${position.disabled ?? false}
        ?readonly=${position.readonly ?? false}
        @jolly-input=${(event: Event) => this.#relay("position", event, true)}
        @jolly-change=${(event: Event) => this.#relay("position", event, false)}
      ></jolly-vector3>
      <jolly-quaternion
        label=${this.rotationLabel}
        label-position=${labelPosition}
        axis-style=${rotationAxisStyle}
        .value=${this.value.rotation}
        .default=${this.default?.rotation}
        .lockedBy=${rotation.lockedBy ?? null}
        .peers=${rotation.peers ?? kNoPeers}
        .error=${rotation.error ?? null}
        ?disabled=${rotation.disabled ?? false}
        ?readonly=${rotation.readonly ?? false}
        @jolly-input=${(event: Event) => this.#relay("rotation", event, true)}
        @jolly-change=${(event: Event) => this.#relay("rotation", event, false)}
      ></jolly-quaternion>
      <jolly-vector3
        label=${this.scaleLabel}
        label-position=${labelPosition}
        axis-style=${vectorAxisStyle}
        .value=${this.value.scale}
        .default=${this.default?.scale}
        .lockedBy=${scale.lockedBy ?? null}
        .peers=${scale.peers ?? kNoPeers}
        .error=${scale.error ?? null}
        ?disabled=${scale.disabled ?? false}
        ?readonly=${scale.readonly ?? false}
        @jolly-input=${(event: Event) => this.#relay("scale", event, true)}
        @jolly-change=${(event: Event) => this.#relay("scale", event, false)}
      ></jolly-vector3>
    `;
  }

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
