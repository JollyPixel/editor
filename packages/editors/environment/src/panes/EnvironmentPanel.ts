// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  EnvironmentSwitch,
  type EnvironmentChange,
  type EnvironmentFile,
  type EnvironmentFogKind,
  type EnvironmentSkyKind
} from "@jolly-pixel/asset.environment/client";
import {
  SubscriptionController,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/color";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/select";

// Import Internal Dependencies
import type { EnvironmentEdits } from "../editing/EnvironmentEdits.ts";

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;
type Section = keyof EnvironmentChange;

interface FieldEdits<TValue> {
  preview(value: TValue): void;
  commit(value: TValue): void;
}

interface NumberRange {
  min: number;
  max?: number;
  step: number;
}

// CONSTANTS
const kSkyKinds: JollyOption<EnvironmentSkyKind>[] = [
  { value: "none", label: "None" },
  { value: "color", label: "Color" },
  { value: "day", label: "Day" },
  { value: "night", label: "Night" }
];
const kReflectionKinds: JollyOption<EnvironmentFile["reflections"]["kind"]>[] = [
  { value: "none", label: "None" },
  { value: "room", label: "Room" }
];
const kFogKinds: JollyOption<EnvironmentFogKind>[] = [
  { value: "none", label: "None" },
  { value: "linear", label: "Linear" },
  { value: "exp2", label: "Exponential" }
];
const kToneMappings: JollyOption<EnvironmentFile["toneMapping"]["kind"]>[] = [
  { value: "none", label: "None" },
  { value: "neutral", label: "Neutral" },
  { value: "aces", label: "ACES Filmic" },
  { value: "agx", label: "AgX" }
];
const kFalloffs: JollyOption<EnvironmentFile["voxel"]["blockLightFalloff"]>[] = [
  { value: "wide", label: "Wide" },
  { value: "focused", label: "Focused" }
];

export class EnvironmentPanel extends LitElement {
  #edits = new SubscriptionController<EnvironmentEdits>(this, (edits) => [
    edits.subscribe("change", () => this.requestUpdate())
  ]);

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-2, 8px);
      overflow: auto;

      --jolly-label-width: 12ch;
    }
  `;

  attach(
    edits: EnvironmentEdits
  ): void {
    this.#edits.attach(edits);
  }

  override render(): TemplateResult | typeof nothing {
    const edits = this.#edits.current;
    if (edits === null) {
      return nothing;
    }

    return this.#renderSections(edits);
  }

  #renderSections(
    edits: EnvironmentEdits
  ): TemplateResult {
    const { file } = edits;
    function section<TSection extends Section>(
      key: TSection
    ): FieldEdits<NonNullable<EnvironmentChange[TSection]>> {
      return sectionEdits(edits, key);
    }

    return html`
      ${folder("sky", "Sky", html`
        ${select("Sky", kSkyKinds, file.sky.kind, (kind) => edits.commit({
          sky: EnvironmentSwitch.sky(file.sky, kind)
        }))}
        ${file.sky.kind === "color" ?
          colorField("Color", file.sky.color, editField(section("sky"), file.sky, "color")) :
          nothing}
      `)}
      ${folder("sun", "Sun", html`
        <jolly-checkbox
          label="Sun"
          .value=${file.sun !== null}
          @jolly-change=${(event: ChangeEvent<boolean>) => edits.commit({
            sun: EnvironmentSwitch.sun(file.sun, event.detail.value)
          })}
        ></jolly-checkbox>
        ${file.sun === null ? nothing : renderSun(file.sun, section("sun"))}
      `)}
      ${folder("ambient", "Ambient", html`
        ${colorField("Sky", file.ambient.skyColor, editField(section("ambient"), file.ambient, "skyColor"))}
        ${colorField(
          "Ground",
          file.ambient.groundColor,
          editField(section("ambient"), file.ambient, "groundColor")
        )}
        ${numberField(
          "Intensity",
          file.ambient.intensity,
          { min: 0, step: 0.05 },
          editField(section("ambient"), file.ambient, "intensity")
        )}
      `)}
      ${folder("reflections", "Reflections", html`
        ${select("Map", kReflectionKinds, file.reflections.kind, (kind) => edits.commit({
          reflections: { ...file.reflections, kind }
        }))}
        ${numberField(
          "Intensity",
          file.reflections.intensity,
          { min: 0, step: 0.05 },
          editField(section("reflections"), file.reflections, "intensity")
        )}
      `)}
      ${folder("fog", "Fog", html`
        ${select("Fog", kFogKinds, file.fog.kind, (kind) => edits.commit({
          fog: EnvironmentSwitch.fog(file.fog, kind)
        }))}
        ${renderFog(file.fog, section("fog"))}
      `)}
      ${folder("tone-mapping", "Tone mapping", html`
        ${select("Curve", kToneMappings, file.toneMapping.kind, (kind) => edits.commit({
          toneMapping: { ...file.toneMapping, kind }
        }))}
        ${numberField(
          "Exposure",
          file.toneMapping.exposure,
          { min: 0, step: 0.05 },
          editField(section("toneMapping"), file.toneMapping, "exposure")
        )}
      `)}
      ${folder("glow", "Glow", html`
        <jolly-checkbox
          label="Bloom"
          .value=${file.glow !== null}
          @jolly-change=${(event: ChangeEvent<boolean>) => edits.commit({
            glow: EnvironmentSwitch.glow(file.glow, event.detail.value)
          })}
        ></jolly-checkbox>
        ${file.glow === null ? nothing : html`
          ${numberField(
            "Strength",
            file.glow.strength,
            { min: 0, step: 0.05 },
            editField(section("glow"), file.glow, "strength")
          )}
          ${numberField(
            "Radius",
            file.glow.radius,
            { min: 0, max: 1, step: 0.05 },
            editField(section("glow"), file.glow, "radius")
          )}
        `}
      `)}
      ${folder("voxel", "Voxel lighting", html`
        ${select("Block light", kFalloffs, file.voxel.blockLightFalloff, (blockLightFalloff) => edits.commit({
          voxel: { ...file.voxel, blockLightFalloff }
        }))}
        ${numberField(
          "Shadow fill",
          file.voxel.shadowFill,
          { min: 0, step: 0.05 },
          editField(section("voxel"), file.voxel, "shadowFill")
        )}
      `)}
    `;
  }
}

function sectionEdits<TSection extends Section>(
  edits: EnvironmentEdits,
  key: TSection
): FieldEdits<NonNullable<EnvironmentChange[TSection]>> {
  return {
    preview: (value) => edits.preview({ [key]: value }),
    commit: (value) => edits.commit({ [key]: value })
  };
}

function renderSun(
  sun: NonNullable<EnvironmentFile["sun"]>,
  edits: FieldEdits<NonNullable<EnvironmentFile["sun"]>>
): TemplateResult {
  return html`
    ${colorField("Color", sun.color, editField(edits, sun, "color"))}
    ${numberField(
      "Intensity",
      sun.intensity,
      { min: 0, step: 0.05 },
      editField(edits, sun, "intensity")
    )}
    ${numberField(
      "Azimuth",
      sun.azimuth,
      { min: -180, max: 180, step: 1 },
      editField(edits, sun, "azimuth")
    )}
    ${numberField(
      "Elevation",
      sun.elevation,
      { min: -90, max: 90, step: 1 },
      editField(edits, sun, "elevation")
    )}
  `;
}

function renderFog(
  fog: EnvironmentFile["fog"],
  edits: FieldEdits<EnvironmentFile["fog"]>
): TemplateResult | typeof nothing {
  if (fog.kind === "none") {
    return nothing;
  }

  const color = colorField("Color", fog.color, editField(edits, fog, "color"));
  if (fog.kind === "exp2") {
    return html`
      ${color}
      ${numberField(
        "Density",
        fog.density,
        { min: 0, step: 0.001 },
        editField(edits, fog, "density")
      )}
    `;
  }

  return html`
    ${color}
    ${numberField("Near", fog.near, { min: 0, step: 0.5 }, editField(edits, fog, "near"))}
    ${numberField("Far", fog.far, { min: 0, step: 0.5 }, editField(edits, fog, "far"))}
  `;
}

function folder(
  key: string,
  label: string,
  content: TemplateResult
): TemplateResult {
  return html`
    <jolly-folder
      key=${key}
      label=${label}
      storage-key=${`environment:folder:${key}`}
      flush
    >
      ${content}
    </jolly-folder>
  `;
}

function select<TValue extends string>(
  label: string,
  options: JollyOption<TValue>[],
  value: TValue,
  commit: (value: TValue) => void
): TemplateResult {
  return html`
    <jolly-select
      label=${label}
      .options=${options}
      .value=${value}
      @jolly-change=${(event: ChangeEvent<TValue>) => commit(event.detail.value)}
    ></jolly-select>
  `;
}

function numberField(
  label: string,
  value: number,
  range: NumberRange,
  edits: FieldEdits<number>
): TemplateResult {
  return html`
    <jolly-number
      label=${label}
      .min=${range.min}
      .max=${range.max ?? Number.POSITIVE_INFINITY}
      .step=${range.step}
      .value=${value}
      @jolly-input=${(event: ChangeEvent<number>) => edits.preview(event.detail.value)}
      @jolly-change=${(event: ChangeEvent<number>) => edits.commit(event.detail.value)}
    ></jolly-number>
  `;
}

function colorField(
  label: string,
  value: string,
  edits: FieldEdits<string>
): TemplateResult {
  return html`
    <jolly-color
      label=${label}
      .value=${value}
      @jolly-input=${(event: ChangeEvent<string>) => edits.preview(event.detail.value)}
      @jolly-change=${(event: ChangeEvent<string>) => edits.commit(event.detail.value)}
    ></jolly-color>
  `;
}

function editField<TObject extends object, TKey extends keyof TObject>(
  edits: FieldEdits<NoInfer<TObject>>,
  object: TObject,
  key: TKey
): FieldEdits<TObject[TKey]> {
  return {
    preview: (value) => edits.preview({ ...object, [key]: value }),
    commit: (value) => edits.commit({ ...object, [key]: value })
  };
}

customElements.define("jolly-environment-panel", EnvironmentPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-environment-panel": EnvironmentPanel;
  }
}
