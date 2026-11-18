// Import Third-party Dependencies
import type {
  AudioSourceSettings,
  AudioZoneMode,
  AudioZoneSettings,
  AudioZoneShapeKind
} from "@jolly-pixel/engine";
import {
  FormRows,
  type ChoiceOption,
  type FormRow
} from "@jolly-pixel/editor.host/scene";

// CONSTANTS
const kVolume = { min: 0, max: 1, step: 0.05 } as const;
const kDistance = { min: 0, step: 0.1 } as const;

const kSourceRows = new FormRows<AudioSourceSettings>();
const kZoneRows = new FormRows<AudioZoneSettings>();

const kZoneModes: readonly ChoiceOption[] = [
  { value: "ambient" satisfies AudioZoneMode, label: "Ambient" },
  { value: "trigger" satisfies AudioZoneMode, label: "Trigger" }
];
const kZoneShapes: readonly ChoiceOption[] = [
  { value: "box" satisfies AudioZoneShapeKind, label: "Box" },
  { value: "sphere" satisfies AudioZoneShapeKind, label: "Sphere" }
];

export function audioSourceForm(): FormRow<AudioSourceSettings>[] {
  return [
    kSourceRows.number(["volume"], "Volume", kVolume),
    kSourceRows.boolean(["spatial"], "Spatial"),
    kSourceRows.boolean(["playOnStart"], "Play on start"),
    kSourceRows.color(["color"], "Tag color")
  ];
}

export function audioZoneForm(
  data: AudioZoneSettings
): FormRow<AudioZoneSettings>[] {
  return [
    kZoneRows.choice(["mode"], "Mode", kZoneModes),
    kZoneRows.choice(["shape"], "Shape", kZoneShapes),
    data.shape === "box" ?
      kZoneRows.vector(["size"], "Size", kDistance) :
      kZoneRows.number(["radius"], "Radius", kDistance),
    {
      control: "text",
      path: ["target"],
      label: "Target actor"
    },
    data.mode === "ambient" ?
      kZoneRows.number(["falloff"], "Falloff", kDistance) :
      kZoneRows.boolean(["stopOnExit"], "Stop on exit"),
    kZoneRows.number(["volume"], "Volume", kVolume),
    kZoneRows.color(["color"], "Tag color")
  ];
}
