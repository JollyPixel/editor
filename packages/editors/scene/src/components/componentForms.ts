export type FieldPath = readonly [string] | readonly [string, string];

export interface ChoiceOption {
  value: string;
  label: string;
}

interface RowBase {
  path: FieldPath;
  label: string;
}

export interface NumberRow extends RowBase {
  control: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanRow extends RowBase {
  control: "boolean";
}

export interface ColorRow extends RowBase {
  control: "color";
}

export interface ChoiceRow extends RowBase {
  control: "choice";
  options: readonly ChoiceOption[];
  resets?: boolean;
}

export interface TextRow extends RowBase {
  control: "text";
}

export interface PropertiesRow extends RowBase {
  control: "properties";
}

export type FormRow =
  | NumberRow
  | BooleanRow
  | ColorRow
  | ChoiceRow
  | TextRow
  | PropertiesRow;

export type ParsedData = object;

export type ComponentForm = (data: ParsedData) => FormRow[];

// CONSTANTS
const kUnit = { min: 0, max: 1, step: 0.01 } as const;
const kSize = { min: 0, step: 0.1 } as const;
const kSegments = { min: 1, step: 1 } as const;

const kProjectionModes: readonly ChoiceOption[] = [
  { value: "perspective", label: "Perspective" },
  { value: "orthographic", label: "Orthographic" }
];

export const LIGHT_KINDS: readonly ChoiceOption[] = [
  { value: "ambient", label: "Ambient" },
  { value: "hemisphere", label: "Hemisphere" },
  { value: "directional", label: "Directional" },
  { value: "point", label: "Point" },
  { value: "spot", label: "Spot" }
];

export const GEOMETRY_KINDS: readonly ChoiceOption[] = [
  { value: "box", label: "Box" },
  { value: "sphere", label: "Sphere" },
  { value: "plane", label: "Plane" },
  { value: "cylinder", label: "Cylinder" },
  { value: "cone", label: "Cone" },
  { value: "torus", label: "Torus" },
  { value: "capsule", label: "Capsule" }
];

const kGeometryRows: Readonly<Record<string, readonly FormRow[]>> = {
  box: [
    number(["geometry", "width"], "Width", kSize),
    number(["geometry", "height"], "Height", kSize),
    number(["geometry", "depth"], "Depth", kSize),
    number(["geometry", "widthSegments"], "Width segments", kSegments),
    number(["geometry", "heightSegments"], "Height segments", kSegments),
    number(["geometry", "depthSegments"], "Depth segments", kSegments)
  ],
  sphere: [
    number(["geometry", "radius"], "Radius", kSize),
    number(["geometry", "widthSegments"], "Width segments", kSegments),
    number(["geometry", "heightSegments"], "Height segments", kSegments)
  ],
  plane: [
    number(["geometry", "width"], "Width", kSize),
    number(["geometry", "height"], "Height", kSize),
    number(["geometry", "widthSegments"], "Width segments", kSegments),
    number(["geometry", "heightSegments"], "Height segments", kSegments)
  ],
  cylinder: [
    number(["geometry", "radiusTop"], "Top radius", kSize),
    number(["geometry", "radiusBottom"], "Bottom radius", kSize),
    number(["geometry", "height"], "Height", kSize),
    number(["geometry", "radialSegments"], "Radial segments", kSegments),
    number(["geometry", "heightSegments"], "Height segments", kSegments),
    boolean(["geometry", "openEnded"], "Open ended")
  ],
  cone: [
    number(["geometry", "radius"], "Radius", kSize),
    number(["geometry", "height"], "Height", kSize),
    number(["geometry", "radialSegments"], "Radial segments", kSegments),
    number(["geometry", "heightSegments"], "Height segments", kSegments),
    boolean(["geometry", "openEnded"], "Open ended")
  ],
  torus: [
    number(["geometry", "radius"], "Radius", kSize),
    number(["geometry", "tube"], "Tube", kSize),
    number(["geometry", "radialSegments"], "Radial segments", kSegments),
    number(["geometry", "tubularSegments"], "Tubular segments", kSegments)
  ],
  capsule: [
    number(["geometry", "radius"], "Radius", kSize),
    number(["geometry", "height"], "Height", kSize),
    number(["geometry", "capSegments"], "Cap segments", kSegments),
    number(["geometry", "radialSegments"], "Radial segments", kSegments),
    number(["geometry", "heightSegments"], "Height segments", kSegments)
  ]
};

const kShadowRows: readonly FormRow[] = [
  boolean(["castShadow"], "Cast shadow"),
  boolean(["receiveShadow"], "Receive shadow")
];

export function cameraForm(
  data: ParsedData
): FormRow[] {
  return [
    choice(["projectionMode"], "Projection", kProjectionModes),
    readField(data, ["projectionMode"]) === "orthographic" ?
      number(["orthographicScale"], "Scale", kSize) :
      number(["fov"], "Field of view", { min: 1, max: 179, step: 1 }),
    number(["near"], "Near", { min: 0, step: 0.01 }),
    number(["far"], "Far", kSize),
    number(["depth"], "Depth", { step: 1 })
  ];
}

export function meshForm(
  data: ParsedData
): FormRow[] {
  const geometry = readField(data, ["geometry", "kind"]);

  return [
    { ...choice(["geometry", "kind"], "Geometry", GEOMETRY_KINDS), resets: true },
    ...kGeometryRows[String(geometry)] ?? [],
    color(["material", "color"], "Color"),
    number(["material", "roughness"], "Roughness", kUnit),
    number(["material", "metalness"], "Metalness", kUnit),
    color(["material", "emissive"], "Emissive"),
    number(["material", "emissiveIntensity"], "Emissive intensity", kSize),
    number(["material", "opacity"], "Opacity", kUnit),
    boolean(["material", "flatShading"], "Flat shading"),
    ...kShadowRows
  ];
}

export function scriptForm(): FormRow[] {
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

export function voxelMapForm(): FormRow[] {
  return [...kShadowRows];
}

export function lightForm(
  data: ParsedData
): FormRow[] {
  const kind = String(readField(data, ["kind"]));
  const rows: FormRow[] = [
    choice(["kind"], "Kind", LIGHT_KINDS),
    color(["color"], kind === "hemisphere" ? "Sky color" : "Color")
  ];
  if (kind === "hemisphere") {
    rows.push(color(["groundColor"], "Ground color"));
  }
  rows.push(number(["intensity"], "Intensity", kSize));
  if (kind === "point" || kind === "spot") {
    rows.push(
      number(["distance"], "Distance", kSize),
      number(["decay"], "Decay", kSize)
    );
  }
  if (kind === "spot") {
    rows.push(
      number(["angle"], "Angle", { min: 0, max: 90, step: 1 }),
      number(["penumbra"], "Penumbra", kUnit)
    );
  }
  if (kind === "directional" || kind === "point" || kind === "spot") {
    rows.push(
      boolean(["castShadow"], "Cast shadow"),
      number(["shadowMapSize"], "Shadow map size", { min: 16, max: 8192, step: 16 }),
      number(["shadowBias"], "Shadow bias", { step: 0.0001 })
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

function number(
  path: FieldPath,
  label: string,
  bounds: Omit<NumberRow, "control" | "path" | "label"> = {}
): NumberRow {
  return {
    control: "number",
    path,
    label,
    ...bounds
  };
}

function boolean(
  path: FieldPath,
  label: string
): BooleanRow {
  return {
    control: "boolean",
    path,
    label
  };
}

function color(
  path: FieldPath,
  label: string
): ColorRow {
  return {
    control: "color",
    path,
    label
  };
}

function choice(
  path: FieldPath,
  label: string,
  options: readonly ChoiceOption[]
): ChoiceRow {
  return {
    control: "choice",
    path,
    label,
    options
  };
}
