// Import Internal Dependencies
import { FieldPatch } from "./FieldPatch.ts";
import type {
  SceneEnvironmentField,
  SceneEnvironmentJSON,
  SceneEnvironmentPatch,
  SceneEnvironmentView,
  SceneFogJSON
} from "../../network/types.ts";

export type SceneFogKind = SceneFogJSON["kind"];
type DefaultFogs = {
  [TKind in SceneFogKind]: Extract<SceneFogJSON, { kind: TKind; }>;
};

// CONSTANTS
const kFogColor = "#c8d2dc";
const kDefaultFogs = {
  none: {
    kind: "none"
  },
  linear: {
    kind: "linear",
    color: kFogColor,
    near: 10,
    far: 100
  },
  exp2: {
    kind: "exp2",
    color: kFogColor,
    density: 0.02
  }
} satisfies DefaultFogs;

export class SceneEnvironment {
  static readonly FIELDS: readonly SceneEnvironmentField[] = [
    "background",
    "environment",
    "fog"
  ];

  static create(): SceneEnvironmentJSON {
    return {
      background: null,
      environment: {
        kind: "none",
        intensity: 1
      },
      fog: {
        kind: "none"
      }
    };
  }

  static patch(
    environment: SceneEnvironmentPatch
  ): FieldPatch<SceneEnvironmentView> {
    return new FieldPatch<SceneEnvironmentView>(SceneEnvironment.FIELDS, environment);
  }

  static switchFog(
    fog: SceneFogJSON,
    kind: SceneFogKind
  ): SceneFogJSON {
    if (kind === fog.kind) {
      return fog;
    }
    if (kind === "none" || fog.kind === "none") {
      return { ...kDefaultFogs[kind] };
    }

    return {
      ...kDefaultFogs[kind],
      color: fog.color
    };
  }
}
