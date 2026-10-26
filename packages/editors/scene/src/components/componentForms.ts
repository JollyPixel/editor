// Import Third-party Dependencies
import type {
  CameraData,
  CameraProjectionMode,
  LightKind,
  LightSettings,
  MeshGeometryKind,
  MeshRendererOptions,
  ScriptData
} from "@jolly-pixel/engine";
import type { VoxelMapSettings } from "@jolly-pixel/voxel.renderer/engine";

type DataKey<TData> = TData extends object ? keyof TData & string : never;
type DataField<TData, TKey extends string> = TData extends object ?
  TKey extends keyof TData ? NonNullable<TData[TKey]> : never :
  never;

type NestedPath<TData> = {
  [TKey in DataKey<TData>]: readonly [TKey, DataKey<DataField<TData, TKey>>];
}[DataKey<TData>];

export type FieldPath<TData = unknown> = unknown extends TData ?
  readonly [string] | readonly [string, string] :
  readonly [DataKey<TData>] | NestedPath<TData>;

export interface ChoiceOption {
  value: string;
  label: string;
}

interface RowBase<TData> {
  path: FieldPath<TData>;
  label: string;
}

export interface NumberRow<TData = unknown> extends RowBase<TData> {
  control: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanRow<TData = unknown> extends RowBase<TData> {
  control: "boolean";
}

export interface ColorRow<TData = unknown> extends RowBase<TData> {
  control: "color";
}

export interface ChoiceRow<TData = unknown> extends RowBase<TData> {
  control: "choice";
  options: readonly ChoiceOption[];
  resets?: boolean;
}

export interface TextRow<TData = unknown> extends RowBase<TData> {
  control: "text";
}

export interface PropertiesRow<TData = unknown> extends RowBase<TData> {
  control: "properties";
}

export type FormRow<TData = unknown> =
  | NumberRow<TData>
  | BooleanRow<TData>
  | ColorRow<TData>
  | ChoiceRow<TData>
  | TextRow<TData>
  | PropertiesRow<TData>;

export type ParsedData = object;

export type ComponentForm<TData> = (data: TData) => FormRow<TData>[];

type NumberBounds = Pick<NumberRow, "min" | "max" | "step">;

class FormRows<TData> {
  number(
    path: FieldPath<TData>,
    label: string,
    bounds: NumberBounds = {}
  ): NumberRow<TData> {
    return {
      control: "number",
      path,
      label,
      ...bounds
    };
  }

  boolean(
    path: FieldPath<TData>,
    label: string
  ): BooleanRow<TData> {
    return {
      control: "boolean",
      path,
      label
    };
  }

  color(
    path: FieldPath<TData>,
    label: string
  ): ColorRow<TData> {
    return {
      control: "color",
      path,
      label
    };
  }

  choice(
    path: FieldPath<TData>,
    label: string,
    options: readonly ChoiceOption[]
  ): ChoiceRow<TData> {
    return {
      control: "choice",
      path,
      label,
      options
    };
  }
}

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

const kProjectionModes = choiceOptions(kProjectionLabels);

export const LIGHT_KINDS = choiceOptions(kLightLabels);
export const GEOMETRY_KINDS = choiceOptions(kGeometryLabels);

const kCamera = new FormRows<CameraData>();
const kLight = new FormRows<LightSettings>();
const kMesh = new FormRows<MeshRendererOptions>();
const kVoxelMap = new FormRows<VoxelMapSettings>();

const kGeometryRows: Readonly<
  Record<MeshGeometryKind, readonly FormRow<MeshRendererOptions>[]>
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
  data: MeshRendererOptions
): FormRow<MeshRendererOptions>[] {
  return [
    {
      ...kMesh.choice(["geometry", "kind"], "Geometry", GEOMETRY_KINDS),
      resets: true
    },
    ...data.geometry === undefined ? [] : kGeometryRows[data.geometry.kind],
    kMesh.color(["material", "color"], "Color"),
    kMesh.number(["material", "roughness"], "Roughness", kUnit),
    kMesh.number(["material", "metalness"], "Metalness", kUnit),
    kMesh.color(["material", "emissive"], "Emissive"),
    kMesh.number(["material", "emissiveIntensity"], "Emissive intensity", kSize),
    kMesh.number(["material", "opacity"], "Opacity", kUnit),
    kMesh.boolean(["material", "flatShading"], "Flat shading"),
    kMesh.boolean(["castShadow"], "Cast shadow"),
    kMesh.boolean(["receiveShadow"], "Receive shadow")
  ];
}

export function scriptForm(): FormRow<ScriptData>[] {
  return [
    {
      control: "text",
      path: ["behavior"],
      label: "Behavior"
    },
    {
      control: "properties",
      path: ["properties"],
      label: "Properties"
    }
  ];
}

export function voxelMapForm(): FormRow<VoxelMapSettings>[] {
  return [
    kVoxelMap.boolean(["castShadow"], "Cast shadow"),
    kVoxelMap.boolean(["receiveShadow"], "Receive shadow")
  ];
}

export function lightForm(
  data: LightSettings
): FormRow<LightSettings>[] {
  const { kind } = data;
  const rows: FormRow<LightSettings>[] = [
    kLight.choice(["kind"], "Kind", LIGHT_KINDS),
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

  return typeof value === "object" && value !== null ?
    ownField(value, nested) :
    undefined;
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
