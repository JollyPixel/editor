// Import Third-party Dependencies
import { TEXTURE_ASSET } from "@jolly-pixel/asset-server";
import { FONT_ASSET } from "@jolly-pixel/asset.font/client";
import type {
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import {
  CameraDefinition,
  LightDefinition,
  MeshDefinition,
  type MeshAssets,
  type MeshData,
  TextDefinition,
  type CameraData,
  type LightSettings,
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
import {
  describeCamera,
  describeLight,
  describeMesh,
  describeRigidBody,
  describeText
} from "./componentSummaries.ts";
import { rigidBodyForm } from "./rigidBodyForm.ts";
import {
  FONT_DOCUMENT_KIND,
  SceneFonts
} from "./SceneFonts.ts";
import {
  TEXTURE_DOCUMENT_KIND,
  SceneTextures
} from "./SceneTextures.ts";

// CONSTANTS
export const BUILT_IN_PACKAGE = "@jolly-pixel/editor.scene";

const kCamera: SceneComponentKind<CameraData> = {
  definition: new CameraDefinition(),
  label: "Camera",
  category: "camera",
  icon: "actor-camera",
  form: cameraForm,
  describe: describeCamera
};
const kLight: SceneComponentKind<LightSettings> = {
  definition: new LightDefinition(),
  label: "Light",
  category: "light",
  initialData: {
    castShadow: true
  },
  icon: "actor-light",
  form: lightForm,
  describe: describeLight
};
const kMesh: SceneComponentKind<MeshData, MeshAssets> = {
  definition: new MeshDefinition(),
  label: "Mesh",
  category: "3d",
  initialData: {
    castShadow: true,
    receiveShadow: true
  },
  icon: "actor-mesh",
  optionalAssets: ["shader"],
  form: meshForm,
  describe: describeMesh
};
const kText: SceneComponentKind<TextSettings> = {
  definition: new TextDefinition(),
  label: "Text",
  category: "3d",
  initialData: {
    text: "Text"
  },
  form: textForm,
  describe: describeText
};
const kRigidBody: SceneComponentKind<SceneRigidBodySettings> = {
  definition: new RigidBodyDefinition(),
  label: "Rigid body",
  category: "physics",
  icon: "actor-rigid-body",
  form: rigidBodyForm,
  describe: describeRigidBody
};
export const BUILT_IN_COMPONENTS: SceneComponentPackage = {
  components: [kCamera, kLight, kMesh, kText, kRigidBody],
  assets: [
    {
      descriptor: FONT_ASSET,
      documentKinds: [FONT_DOCUMENT_KIND],
      open: (session, updates) => new SceneFonts(session, updates)
    },
    {
      descriptor: TEXTURE_ASSET,
      documentKinds: [TEXTURE_DOCUMENT_KIND],
      open: (session, updates) => new SceneTextures(session, updates)
    }
  ]
};
