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
import type { JollyChangeDetail } from "../field/events.ts";
import { emitComposedEvent } from "../events.ts";
import { readDetail } from "../dom.ts";
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

export type TransformRotationFormat = "quaternion" | "euler";

export interface TransformValue {
  position: VectorValue<TransformAxis3>;
  rotation: FieldValue<QuatLike> | VectorValue<TransformAxis3>;
  scale: VectorValue<TransformAxis3>;
}

export interface TransformChangeDetail extends JollyChangeDetail<TransformValue> {
  field: TransformSubKey;
}

export interface TransformDefault {
  position?: Record<TransformAxis3, number>;
  rotation?: QuatLike | Record<TransformAxis3, number>;
  scale?: Record<TransformAxis3, number>;
}

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
const kEulerStep = 1;

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
    attribute: "rotation-format"
  })
  declare rotationFormat: TransformRotationFormat;

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
    this.rotationFormat = "quaternion";
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

    return html`
      ${this.#vectorRow("position", this.positionLabel, labelPosition)}
      ${this.rotationFormat === "euler" ?
        this.#vectorRow(
          "rotation",
          this.rotationLabel,
          labelPosition,
          kEulerStep
        ) :
        this.#quaternionRow(labelPosition)}
      ${this.#vectorRow("scale", this.scaleLabel, labelPosition)}
    `;
  }

  #vectorRow(
    field: TransformSubKey,
    label: string,
    labelPosition: FieldLabelPosition,
    step = Vector3.Defaults.step
  ): TemplateResult {
    const state = this.state[field] ?? kEmptySubState;

    return html`
      <jolly-vector3
        label=${label}
        label-position=${labelPosition}
        axis-style=${this.axisStyle ?? Vector3.Defaults.axisStyle}
        .step=${step}
        .value=${this.value[field]}
        .default=${this.default?.[field]}
        .lockedBy=${state.lockedBy ?? null}
        .peers=${state.peers ?? kNoPeers}
        .error=${state.error ?? null}
        ?disabled=${state.disabled ?? false}
        ?readonly=${state.readonly ?? false}
        @jolly-input=${(event: Event) => this.#relay(field, event, true)}
        @jolly-change=${(event: Event) => this.#relay(field, event, false)}
      ></jolly-vector3>
    `;
  }

  #quaternionRow(
    labelPosition: FieldLabelPosition
  ): TemplateResult {
    const state = this.state.rotation ?? kEmptySubState;

    return html`
      <jolly-quaternion
        label=${this.rotationLabel}
        label-position=${labelPosition}
        axis-style=${this.axisStyle ?? Quaternion.Defaults.axisStyle}
        .value=${this.value.rotation}
        .default=${this.default?.rotation}
        .lockedBy=${state.lockedBy ?? null}
        .peers=${state.peers ?? kNoPeers}
        .error=${state.error ?? null}
        ?disabled=${state.disabled ?? false}
        ?readonly=${state.readonly ?? false}
        @jolly-input=${(event: Event) => this.#relay("rotation", event, true)}
        @jolly-change=${(event: Event) => this.#relay("rotation", event, false)}
      ></jolly-quaternion>
    `;
  }

  #relay(
    field: TransformSubKey,
    event: Event,
    live: boolean
  ): void {
    event.stopPropagation();
    const detail = readDetail<{ value: unknown; }>(event);
    if (detail === null) {
      return;
    }

    emitComposedEvent<TransformChangeDetail>(
      this,
      live ? "jolly-input" : "jolly-change",
      {
        value: {
          ...this.value,
          [field]: detail.value
        },
        field
      }
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-transform": Transform;
  }
}
