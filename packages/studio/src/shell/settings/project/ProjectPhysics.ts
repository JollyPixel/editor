// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";
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
import type { StudioProjectSettings } from "../../../project/StudioProjectSettings.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsDraftController } from "./SettingsDraftController.ts";

// CONSTANTS
const kEngineDescription = "Simulates rigid bodies and voxel map collisions. " +
  "A game loads it only when a scene uses one.";
const kEngineLabels: Readonly<Record<PhysicsEngine, string>> = {
  rapier: "Rapier"
};

type Gravity = PhysicsSection["gravity"];

class PhysicsDraft {
  readonly engine: PhysicsEngine;
  readonly gravity: Readonly<Gravity>;

  constructor(
    section: Readonly<PhysicsSection>
  ) {
    this.engine = section.engine;
    this.gravity = { ...section.gravity };
  }

  withEngine(
    engine: PhysicsEngine
  ): PhysicsDraft {
    return new PhysicsDraft({
      engine,
      gravity: this.gravity
    });
  }

  withGravity(
    gravity: Readonly<Gravity>
  ): PhysicsDraft {
    return new PhysicsDraft({
      engine: this.engine,
      gravity
    });
  }

  toJSON(): PhysicsSection {
    return {
      engine: this.engine,
      gravity: { ...this.gravity }
    };
  }
}

@customElement("studio-project-physics")
export class ProjectPhysics extends LitElement {
  static override styles = [settingsStyles];

  #draft = new SettingsDraftController(this, {
    saved: (data) => new PhysicsDraft(data.physics),
    save: (project, draft) => project.replacePhysics(draft.toJSON())
  });

  set project(
    project: StudioProjectSettings
  ) {
    this.#draft.attach(project);
  }

  override render(): TemplateResult | typeof nothing {
    const { project, draft } = this.#draft;
    if (project === null || draft === null) {
      return nothing;
    }

    return html`
      <section aria-label="Physics">
        <jolly-separator label="Physics"></jolly-separator>
        ${this.#draft.error()}
        <jolly-select
          data-field="physics-engine"
          label="Engine"
          description=${kEngineDescription}
          description-display="tooltip"
          ?disabled=${!project.canEdit}
          .options=${PHYSICS_ENGINES.map((engine) => {
            return {
              value: engine,
              label: kEngineLabels[engine]
            };
          })}
          .value=${draft.engine}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<PhysicsEngine>>) => {
            this.#draft.edit(draft.withEngine(event.detail.value));
          }}
        ></jolly-select>
        <jolly-vector3
          data-field="gravity"
          label="Gravity"
          step="0.01"
          ?disabled=${!project.canEdit}
          .value=${draft.gravity}
          .default=${DEFAULT_PHYSICS.gravity}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<Gravity>>) => {
            this.#draft.edit(draft.withGravity(event.detail.value));
          }}
        ></jolly-vector3>
      </section>
      ${project.canEdit ? this.#draft.actions("Physics actions") : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-physics": ProjectPhysics;
  }
}
