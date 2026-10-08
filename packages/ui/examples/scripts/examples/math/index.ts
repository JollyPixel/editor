// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const MATH_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "math/vector2",
    title: "Vector2",
    load: async() => (await import("./vector2.ts")).VECTOR2_EXAMPLE
  },
  {
    id: "math/vector3",
    title: "Vector3",
    load: async() => (await import("./vector3.ts")).VECTOR3_EXAMPLE
  },
  {
    id: "math/vector4",
    title: "Vector4",
    load: async() => (await import("./vector4.ts")).VECTOR4_EXAMPLE
  },
  {
    id: "math/quaternion",
    title: "Quaternion",
    load: async() => (await import("./quaternion.ts")).QUATERNION_EXAMPLE
  },
  {
    id: "math/transform",
    title: "Transform",
    load: async() => (await import("./transform.ts")).TRANSFORM_EXAMPLE
  },
  {
    id: "math/point2d",
    title: "Point2d",
    load: async() => (await import("./point2d.ts")).POINT2D_EXAMPLE
  }
];
