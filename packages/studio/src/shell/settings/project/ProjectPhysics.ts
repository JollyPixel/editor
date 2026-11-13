// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/vector3";
import {
  DEFAULT_PHYSICS,
  PHYSICS_ENGINES,
  type PhysicsEngine,
  type PhysicsSection
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsEditEvent } from "../SettingsEditEvent.ts";

// CONSTANTS
const kEngineDescription = "Simulates rigid bodies and voxel map collisions. " +
  "A game loads it only when a scene uses one.";
const kEngineLabels: Readonly<Record<PhysicsEngine, string>> = {
  rapier: "Rapier"
};

type Gravity = PhysicsSection["gravity"];

@customElement("studio-project-physics")
export class ProjectPhysics extends LitElement {
  static override styles = [settingsStyles];

  @property({ attribute: false })
  declare value: PhysicsSection | null;

  @property({ type: Boolean })
  declare disabled: boolean;

  constructor() {
    super();
    this.value = null;
    this.disabled = false;
  }

  override render(): TemplateResult | typeof nothing {
    const { value } = this;
    if (value === null) {
      return nothing;
    }

    return html`
      <section aria-label="Physics">
        <jolly-separator label="Physics"></jolly-separator>
        <jolly-select
          data-field="physics-engine"
          label="Engine"
          description=${kEngineDescription}
          description-display="tooltip"
          ?disabled=${this.disabled}
          .options=${PHYSICS_ENGINES.map((engine) => {
            return {
              value: engine,
              label: kEngineLabels[engine]
            };
          })}
          .value=${value.engine}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<PhysicsEngine>>) => {
            this.#edit({
              ...value,
              engine: event.detail.value
            });
          }}
        ></jolly-select>
        <jolly-vector3
          data-field="gravity"
          label="Gravity"
          step="0.01"
          ?disabled=${this.disabled}
          .value=${value.gravity}
          .default=${DEFAULT_PHYSICS.gravity}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<Gravity>>) => {
            this.#edit({
              ...value,
              gravity: event.detail.value
            });
          }}
        ></jolly-vector3>
      </section>
    `;
  }

  #edit(
    physics: PhysicsSection
  ): void {
    this.dispatchEvent(new SettingsEditEvent("physics", physics));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-physics": ProjectPhysics;
  }
}
