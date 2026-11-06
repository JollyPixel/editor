// Import Third-party Dependencies
import { FONT_ASSET } from "@jolly-pixel/asset.font/client";
import type {
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import {
  CameraDefinition,
  LightDefinition,
  MeshDefinition,
  TextDefinition,
  type CameraData,
  type LightSettings,
  type MeshRendererOptions,
  type TextSettings
} from "@jolly-pixel/engine";
import {
  RigidBodyDefinition,
  type SceneRigidBodySettings
} from "@jolly-pixel/physics/engine";

// Import Internal Dependencies
import {
  cameraForm,
  lightForm,
  meshForm,
  textForm
} from "./componentForms.ts";
import { rigidBodyForm } from "./rigidBodyForm.ts";
import {
  FONT_DOCUMENT_KIND,
  SceneFonts
} from "./SceneFonts.ts";

// CONSTANTS
export const BUILT_IN_PACKAGE = "@jolly-pixel/editor.scene";

const kCamera: SceneComponentKind<CameraData> = {
  definition: new CameraDefinition(),
  label: "Camera",
  category: "camera",
  icon: "actor-camera",
  form: cameraForm
};
const kLight: SceneComponentKind<LightSettings> = {
  definition: new LightDefinition(),
  label: "Light",
  category: "light",
  initialData: {
    castShadow: true
  },
  icon: "actor-light",
  form: lightForm
};
const kMesh: SceneComponentKind<MeshRendererOptions> = {
  definition: new MeshDefinition(),
  label: "Mesh",
  category: "3d",
  initialData: {
    castShadow: true,
    receiveShadow: true
  },
  icon: "actor-mesh",
  form: meshForm
};
const kText: SceneComponentKind<TextSettings> = {
  definition: new TextDefinition(),
  label: "Text",
  category: "3d",
  initialData: {
    text: "Text"
  },
  form: textForm
};
const kRigidBody: SceneComponentKind<SceneRigidBodySettings> = {
  definition: new RigidBodyDefinition(),
  label: "Rigid body",
  category: "physics",
  icon: "actor-rigid-body",
  form: rigidBodyForm
};
export const BUILT_IN_COMPONENTS: SceneComponentPackage = {
  components: [kCamera, kLight, kMesh, kText, kRigidBody],
  assets: [
    {
      descriptor: FONT_ASSET,
      documentKinds: [FONT_DOCUMENT_KIND],
      open: (session, updates) => new SceneFonts(session, updates)
    }
  ]
};
