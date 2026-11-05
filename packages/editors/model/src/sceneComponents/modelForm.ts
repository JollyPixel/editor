// Import Third-party Dependencies
import {
  FormRows,
  type ChoiceOption,
  type FormRow
} from "@jolly-pixel/editor.host/scene";
import type {
  Model,
  ModelSettings
} from "@jolly-pixel/engine";

// CONSTANTS
const kRows = new FormRows<ModelSettings>();
const kNoAnimation: ChoiceOption = {
  value: "",
  label: "None"
};

export function modelForm(
  data: ModelSettings,
  model: Model | null
): FormRow<ModelSettings>[] {
  return [
    kRows.choice(["animation"], "Animation", animationChoices(data, model)),
    kRows.boolean(["castShadow"], "Cast shadow"),
    kRows.boolean(["receiveShadow"], "Receive shadow")
  ];
}

function animationChoices(
  data: ModelSettings,
  model: Model | null
): ChoiceOption[] {
  const names = new Set(model?.animations.map((clip) => clip.name));
  if (data.animation !== "") {
    names.add(data.animation);
  }

  return [
    kNoAnimation,
    ...[...names].map((name) => {
      return {
        value: name,
        label: name
      };
    })
  ];
}
