// Import Third-party Dependencies
import type {
  CameraData,
  CameraProjectionMode,
  LightKind,
  LightSettings,
  MeshGeometryKind,
  MeshSettings,
  MeshSurfaceSettings,
  TextAlign,
  TextSettings
} from "@jolly-pixel/engine";
import {
  FormRows,
  type ChoiceOption,
  type FieldPath,
  type FormRow
} from "@jolly-pixel/editor.host/scene";
import { is } from "@jolly-pixel/utils";

export type ParsedData = object;

// CONSTANTS
const kUnit = { min: 0, max: 1, step: 0.01 } as const;
const kSize = { min: 0, step: 0.1 } as const;
const kSegments = { min: 1, step: 1 } as const;

const kProjectionLabels: Readonly<Record<CameraProjectionMode, string>> = {
  perspective: "Perspective",
  orthographic: "Orthographic"
};
const kLightLabels: Readonly<Record<LightKind, string>> = {
  ambient: "Ambient",
  hemisphere: "Hemisphere",
  directional: "Directional",
  point: "Point",
  spot: "Spot"
};
const kGeometryLabels: Readonly<Record<MeshGeometryKind, string>> = {
  box: "Box",
  sphere: "Sphere",
  plane: "Plane",
  cylinder: "Cylinder",
  cone: "Cone",
  torus: "Torus",
  capsule: "Capsule"
};

const kAlignLabels: Readonly<Record<TextAlign, string>> = {
  left: "Left",
  center: "Center",
  right: "Right"
};

const kProjectionModes = choiceOptions(kProjectionLabels);
const kTextAligns = choiceOptions(kAlignLabels);

const kLightKinds = choiceOptions(kLightLabels);
const kGeometryKinds = choiceOptions(kGeometryLabels);

const kCamera = new FormRows<CameraData>();
const kLight = new FormRows<LightSettings>();
const kMesh = new FormRows<MeshSettings>();
const kText = new FormRows<TextSettings>();
const kSurface = new FormRows<MeshSurfaceSettings>();

const kSurfaceRows: readonly FormRow<MeshSurfaceSettings>[] = [
  kSurface.number(["material", "roughness"], "Roughness", kUnit),
  kSurface.number(["material", "metalness"], "Metalness", kUnit),
  kSurface.color(["material", "emissive"], "Emissive"),
  kSurface.number(["material", "emissiveIntensity"], "Emissive intensity", kSize),
  kSurface.number(["material", "opacity"], "Opacity", kUnit),
  kSurface.boolean(["material", "flatShading"], "Flat shading"),
  kSurface.boolean(["castShadow"], "Cast shadow"),
  kSurface.boolean(["receiveShadow"], "Receive shadow")
];

const kGeometryRows: Readonly<
  Record<MeshGeometryKind, readonly FormRow<MeshSettings>[]>
> = {
  box: [
    kMesh.number(["geometry", "width"], "Width", kSize),
    kMesh.number(["geometry", "height"], "Height", kSize),
    kMesh.number(["geometry", "depth"], "Depth", kSize),
    kMesh.number(["geometry", "widthSegments"], "Width segments", kSegments),
    kMesh.number(["geometry", "heightSegments"], "Height segments", kSegments),
    kMesh.number(["geometry", "depthSegments"], "Depth segments", kSegments)
  ],
  sphere: [
    kMesh.number(["geometry", "radius"], "Radius", kSize),
    kMesh.number(["geometry", "widthSegments"], "Width segments", kSegments),
    kMesh.number(["geometry", "heightSegments"], "Height segments", kSegments)
  ],
  plane: [
    kMesh.number(["geometry", "width"], "Width", kSize),
    kMesh.number(["geometry", "height"], "Height", kSize),
    kMesh.number(["geometry", "widthSegments"], "Width segments", kSegments),
    kMesh.number(["geometry", "heightSegments"], "Height segments", kSegments)
  ],
  cylinder: [
    kMesh.number(["geometry", "radiusTop"], "Top radius", kSize),
    kMesh.number(["geometry", "radiusBottom"], "Bottom radius", kSize),
    kMesh.number(["geometry", "height"], "Height", kSize),
    kMesh.number(["geometry", "radialSegments"], "Radial segments", kSegments),
    kMesh.number(["geometry", "heightSegments"], "Height segments", kSegments),
    kMesh.boolean(["geometry", "openEnded"], "Open ended")
  ],
  cone: [
    kMesh.number(["geometry", "radius"], "Radius", kSize),
    kMesh.number(["geometry", "height"], "Height", kSize),
    kMesh.number(["geometry", "radialSegments"], "Radial segments", kSegments),
    kMesh.number(["geometry", "heightSegments"], "Height segments", kSegments),
    kMesh.boolean(["geometry", "openEnded"], "Open ended")
  ],
  torus: [
    kMesh.number(["geometry", "radius"], "Radius", kSize),
    kMesh.number(["geometry", "tube"], "Tube", kSize),
    kMesh.number(["geometry", "radialSegments"], "Radial segments", kSegments),
    kMesh.number(["geometry", "tubularSegments"], "Tubular segments", kSegments)
  ],
  capsule: [
    kMesh.number(["geometry", "radius"], "Radius", kSize),
    kMesh.number(["geometry", "height"], "Height", kSize),
    kMesh.number(["geometry", "capSegments"], "Cap segments", kSegments),
    kMesh.number(["geometry", "radialSegments"], "Radial segments", kSegments),
    kMesh.number(["geometry", "heightSegments"], "Height segments", kSegments)
  ]
};

export function cameraForm(
  data: CameraData
): FormRow<CameraData>[] {
  return [
    kCamera.choice(["projectionMode"], "Projection", kProjectionModes),
    data.projectionMode === "orthographic" ?
      kCamera.number(["orthographicScale"], "Scale", kSize) :
      kCamera.number(["fov"], "Field of view", { min: 1, max: 179, step: 1 }),
    kCamera.number(["near"], "Near", { min: 0, step: 0.01 }),
    kCamera.number(["far"], "Far", kSize),
    kCamera.number(["depth"], "Depth", { step: 1 })
  ];
}

export function meshForm(
  data: MeshSettings
): FormRow<MeshSettings>[] {
  return [
    {
      ...kMesh.choice(["geometry", "kind"], "Geometry", kGeometryKinds),
      resets: true
    },
    kMesh.color(["material", "color"], "Color"),
    ...kGeometryRows[data.geometry.kind],
    ...kSurfaceRows
  ];
}

export function textForm(
  data: TextSettings
): FormRow<TextSettings>[] {
  return [
    {
      control: "text",
      path: ["text"],
      label: "Text"
    },
    kText.choice(["align"], "Align", kTextAligns),
    kText.color(["material", "color"], "Color"),
    kText.number(["size"], "Size", kSize),
    kText.number(["depth"], "Depth", { min: 0, step: 0.05 }),
    kText.number(["curveSegments"], "Curve segments", kSegments),
    kText.boolean(["bevel"], "Bevel"),
    ...data.bevel ?
      [
        kText.number(["bevelThickness"], "Bevel thickness", { min: 0, step: 0.01 }),
        kText.number(["bevelSize"], "Bevel size", { min: 0, step: 0.01 })
      ] :
      [],
    ...kSurfaceRows
  ];
}

export function lightForm(
  data: LightSettings
): FormRow<LightSettings>[] {
  const { kind } = data;
  const rows: FormRow<LightSettings>[] = [
    kLight.choice(["kind"], "Kind", kLightKinds),
    kLight.color(["color"], kind === "hemisphere" ? "Sky color" : "Color")
  ];
  if (kind === "hemisphere") {
    rows.push(kLight.color(["groundColor"], "Ground color"));
  }
  rows.push(kLight.number(["intensity"], "Intensity", kSize));
  if (kind === "point" || kind === "spot") {
    rows.push(
      kLight.number(["distance"], "Distance", kSize),
      kLight.number(["decay"], "Decay", kSize)
    );
  }
  if (kind === "spot") {
    rows.push(
      kLight.number(["angle"], "Angle", { min: 0, max: 90, step: 1 }),
      kLight.number(["penumbra"], "Penumbra", kUnit)
    );
  }
  if (kind === "directional" || kind === "point" || kind === "spot") {
    rows.push(
      kLight.boolean(["castShadow"], "Cast shadow"),
      kLight.number(["shadowMapSize"], "Shadow map size", { min: 16, max: 8192, step: 16 }),
      kLight.number(["shadowBias"], "Shadow bias", { step: 0.0001 })
    );
  }

  return rows;
}

export function readField(
  data: ParsedData,
  path: FieldPath
): unknown {
  const [key, nested] = path;
  const value = ownField(data, key);
  if (nested === undefined) {
    return value;
  }

  return is.object(value) ? ownField(value, nested) : undefined;
}

function ownField(
  data: object,
  key: string
): unknown {
  return Object.hasOwn(data, key) ? Reflect.get(data, key) : undefined;
}

function choiceOptions(
  labels: Readonly<Record<string, string>>
): readonly ChoiceOption[] {
  return Object.entries(labels).map(([value, label]) => {
    return {
      value,
      label
    };
  });
}
