// Import Third-party Dependencies
import type { ScriptOutline } from "@jolly-pixel/asset.script/client";
import type {
  ChoiceOption,
  DeclaredProperty,
  FormRow
} from "@jolly-pixel/editor.host/scene";
import {
  SCENE_PROPERTY_TYPES,
  type ScriptData
} from "@jolly-pixel/engine";

// CONSTANTS
const kNoBehavior: ChoiceOption = {
  value: "",
  label: "None"
};

export function scriptForm(
  data: ScriptData,
  outline: ScriptOutline | null
): FormRow<ScriptData>[] {
  const behaviors = outline?.behaviors ?? [];
  const behavior = behaviors.find(({ name }) => name === data.behavior);
  const declared: DeclaredProperty[] = [];
  for (const property of behavior?.properties ?? []) {
    const type = SCENE_PROPERTY_TYPES.find((known) => known === property.type);
    if (type !== undefined) {
      declared.push({
        ...property,
        type
      });
    }
  }

  return [
    behaviors.length === 0 ?
      {
        control: "text",
        path: ["behavior"],
        label: "Behavior"
      } :
      {
        control: "choice",
        path: ["behavior"],
        label: "Behavior",
        options: behaviorOptions(data.behavior, behaviors.map(({ name }) => name))
      },
    {
      control: "properties",
      path: ["properties"],
      label: "Properties",
      declared
    }
  ];
}

function behaviorOptions(
  current: string,
  names: readonly string[]
): ChoiceOption[] {
  const options = names.map((name) => {
    return {
      value: name,
      label: name
    };
  });
  if (current !== "" && !names.includes(current)) {
    options.push({
      value: current,
      label: `${current} (missing)`
    });
  }

  return [kNoBehavior, ...options];
}
