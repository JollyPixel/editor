// Import Third-party Dependencies
import {
  MATERIAL_SURFACE_PROPERTIES,
  type MaterialSurfaceJSON
} from "@jolly-pixel/asset.voxel-model/client";

type SurfaceKeyOf<TValue> = {
  [TKey in keyof MaterialSurfaceJSON]: MaterialSurfaceJSON[TKey] extends TValue ? TKey : never;
}[keyof MaterialSurfaceJSON];

export type ColorKey = SurfaceKeyOf<string>;
export type NumberKey = SurfaceKeyOf<number>;

type SurfaceSchemas = typeof MATERIAL_SURFACE_PROPERTIES;

type UnboundedKey = {
  [TKey in NumberKey]: SurfaceSchemas[TKey] extends { maximum: number; } ? never : TKey;
}[NumberKey];

export type SurfaceField =
  | {
    control: "color";
    key: ColorKey;
    label: string;
    help: string;
  }
  | {
    control: "slider";
    key: Exclude<NumberKey, UnboundedKey>;
    label: string;
    help: string;
  }
  | {
    control: "slider";
    key: UnboundedKey;
    label: string;
    /** The slider's end, which the schema leaves open. */
    max: number;
    help: string;
  };

export type SurfaceGroupId = "color" | "surface" | "glow";

export interface SurfaceGroup {
  id: SurfaceGroupId;
  label: string;
  fields: readonly SurfaceField[];
}

export const SURFACE_GROUPS: readonly SurfaceGroup[] = [
  {
    id: "color",
    label: "Color",
    fields: [
      {
        control: "color",
        key: "color",
        label: "Tint",
        help: "Multiplies the texture color. White keeps the texture as painted."
      },
      {
        control: "slider",
        key: "opacity",
        label: "Opacity",
        help: "1 is solid, 0 is invisible. " +
          "Below 1 the block turns see-through and stops hiding what's behind it."
      }
    ]
  },
  {
    id: "surface",
    label: "Surface",
    fields: [
      {
        control: "slider",
        key: "roughness",
        label: "Roughness",
        help: "How blurred reflections are. 0 is a sharp mirror shine, 1 is matte."
      },
      {
        control: "slider",
        key: "metalness",
        label: "Metalness",
        help: "0 is a non-metal like plastic, wood or stone. " +
          "1 is metal, which reflects its surroundings tinted by its color."
      }
    ]
  },
  {
    id: "glow",
    label: "Glow",
    fields: [
      {
        control: "color",
        key: "emissive",
        label: "Color",
        help: "The color the block glows with, even in the dark. Black means no glow."
      },
      {
        control: "slider",
        key: "emissiveIntensity",
        label: "Intensity",
        max: 5,
        help: "The strength of the glow. 0 turns it off; above 1 is brighter than lit color."
      }
    ]
  }
];

export const MATERIAL_HELP = "Editing a material changes every block that uses it; " +
  "the header counts them.";

export const UNLIT_NOTE = "Roughness and metalness show with View > Shading: Lit.";

export function sliderMax(
  field: Extract<SurfaceField, { control: "slider"; }>
): number {
  return "max" in field ?
    field.max :
    MATERIAL_SURFACE_PROPERTIES[field.key].maximum;
}
