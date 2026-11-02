// Import Third-party Dependencies
import { FONT_ASSET } from "@jolly-pixel/asset.font/client";
import type {
  SceneActorPreset,
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import {
  CameraDefinition,
  LightDefinition,
  MeshDefinition,
  ScriptDefinition,
  TextDefinition,
  type CameraData,
  type LightSettings,
  type MeshRendererOptions,
  type ScriptData,
  type TextSettings
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  cameraForm,
  GEOMETRY_KINDS,
  LIGHT_KINDS,
  lightForm,
  meshForm,
  scriptForm,
  textForm
} from "./componentForms.ts";
import { EMPTY_ACTOR_ICON } from "./SceneComponents.ts";
import {
  FONT_DOCUMENT_KIND,
  SceneFonts
} from "./SceneFonts.ts";

// CONSTANTS
export const BUILT_IN_PACKAGE = "@jolly-pixel/editor.scene";
const kShadowCasters: ReadonlySet<string> = new Set(["directional", "spot"]);

const kCamera: SceneComponentKind<CameraData> = {
  definition: new CameraDefinition(),
  label: "Camera",
  icon: "actor-camera",
  form: cameraForm
};
const kLight: SceneComponentKind<LightSettings> = {
  definition: new LightDefinition(),
  label: "Light",
  icon: "actor-light",
  form: lightForm
};
const kMesh: SceneComponentKind<MeshRendererOptions> = {
  definition: new MeshDefinition(),
  label: "Mesh",
  icon: "actor-mesh",
  form: meshForm
};
const kText: SceneComponentKind<TextSettings> = {
  definition: new TextDefinition(),
  label: "Text",
  icon: "actor-text",
  form: textForm
};
const kScript: SceneComponentKind<ScriptData> = {
  definition: new ScriptDefinition({}),
  label: "Script",
  icon: EMPTY_ACTOR_ICON,
  form: scriptForm
};

export const BUILT_IN_COMPONENTS: SceneComponentPackage = {
  components: [kCamera, kLight, kMesh, kText, kScript],
  presets: [
    {
      id: "empty",
      label: "Empty",
      components: []
    },
    {
      id: "camera",
      label: "Camera",
      components: [
        {
          type: "Camera",
          data: {}
        }
      ]
    },
    {
      label: "Light",
      presets: LIGHT_KINDS.map(({ value: kind, label }): SceneActorPreset => {
        return {
          id: `light:${kind}`,
          label: `${label} Light`,
          components: [
            {
              type: "Light",
              data: kShadowCasters.has(kind) ?
                { kind, castShadow: true } :
                { kind }
            }
          ]
        };
      })
    },
    {
      id: "text",
      label: "Text",
      components: [
        {
          type: "Text",
          data: {
            text: "Text"
          }
        }
      ]
    },
    {
      label: "Primitive",
      presets: GEOMETRY_KINDS.map(({ value: kind, label }) => {
        return {
          id: `mesh:${kind}`,
          label,
          components: [
            {
              type: "Mesh",
              data: {
                geometry: { kind },
                castShadow: true,
                receiveShadow: true
              }
            }
          ]
        };
      })
    }
  ],
  assets: [
    {
      descriptor: FONT_ASSET,
      documentKinds: [FONT_DOCUMENT_KIND],
      open: (session, updates) => new SceneFonts(session, updates)
    }
  ]
};
