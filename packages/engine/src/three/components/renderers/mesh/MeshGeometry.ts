// Import Third-party Dependencies
import * as THREE from "three/webgpu";

export type MeshGeometry =
  | {
    kind: "box";
    width: number;
    height: number;
    depth: number;
    widthSegments: number;
    heightSegments: number;
    depthSegments: number;
  }
  | {
    kind: "sphere";
    radius: number;
    widthSegments: number;
    heightSegments: number;
  }
  | {
    kind: "plane";
    width: number;
    height: number;
    widthSegments: number;
    heightSegments: number;
  }
  | {
    kind: "cylinder";
    radiusTop: number;
    radiusBottom: number;
    height: number;
    radialSegments: number;
    heightSegments: number;
    openEnded: boolean;
  }
  | {
    kind: "cone";
    radius: number;
    height: number;
    radialSegments: number;
    heightSegments: number;
    openEnded: boolean;
  }
  | {
    kind: "torus";
    radius: number;
    tube: number;
    radialSegments: number;
    tubularSegments: number;
  }
  | {
    kind: "capsule";
    radius: number;
    height: number;
    capSegments: number;
    radialSegments: number;
    heightSegments: number;
  };

export type MeshGeometryKind = MeshGeometry["kind"];

export type MeshGeometryOf<TKind extends MeshGeometryKind> = Extract<
  MeshGeometry,
  { kind: TKind; }
>;

// CONSTANTS
export const MESH_GEOMETRY_DEFAULTS: {
  readonly [TKind in MeshGeometryKind]: Readonly<MeshGeometryOf<TKind>>;
} = {
  box: {
    kind: "box",
    width: 1,
    height: 1,
    depth: 1,
    widthSegments: 1,
    heightSegments: 1,
    depthSegments: 1
  },
  sphere: {
    kind: "sphere",
    radius: 1,
    widthSegments: 32,
    heightSegments: 16
  },
  plane: {
    kind: "plane",
    width: 1,
    height: 1,
    widthSegments: 1,
    heightSegments: 1
  },
  cylinder: {
    kind: "cylinder",
    radiusTop: 1,
    radiusBottom: 1,
    height: 1,
    radialSegments: 32,
    heightSegments: 1,
    openEnded: false
  },
  cone: {
    kind: "cone",
    radius: 1,
    height: 1,
    radialSegments: 32,
    heightSegments: 1,
    openEnded: false
  },
  torus: {
    kind: "torus",
    radius: 1,
    tube: 0.4,
    radialSegments: 12,
    tubularSegments: 48
  },
  capsule: {
    kind: "capsule",
    radius: 1,
    height: 1,
    capSegments: 4,
    radialSegments: 8,
    heightSegments: 1
  }
};

export function createMeshGeometry(
  geometry: MeshGeometry
): THREE.BufferGeometry {
  switch (geometry.kind) {
    case "box":
      return new THREE.BoxGeometry(
        geometry.width,
        geometry.height,
        geometry.depth,
        geometry.widthSegments,
        geometry.heightSegments,
        geometry.depthSegments
      );
    case "sphere":
      return new THREE.SphereGeometry(
        geometry.radius,
        geometry.widthSegments,
        geometry.heightSegments
      );
    case "plane":
      return new THREE.PlaneGeometry(
        geometry.width,
        geometry.height,
        geometry.widthSegments,
        geometry.heightSegments
      );
    case "cylinder":
      return new THREE.CylinderGeometry(
        geometry.radiusTop,
        geometry.radiusBottom,
        geometry.height,
        geometry.radialSegments,
        geometry.heightSegments,
        geometry.openEnded
      );
    case "cone":
      return new THREE.ConeGeometry(
        geometry.radius,
        geometry.height,
        geometry.radialSegments,
        geometry.heightSegments,
        geometry.openEnded
      );
    case "torus":
      return new THREE.TorusGeometry(
        geometry.radius,
        geometry.tube,
        geometry.radialSegments,
        geometry.tubularSegments
      );
    case "capsule":
      return new THREE.CapsuleGeometry(
        geometry.radius,
        geometry.height,
        geometry.capSegments,
        geometry.radialSegments,
        geometry.heightSegments
      );
  }
}

export function isSameMeshGeometry(
  left: MeshGeometry,
  right: MeshGeometry
): boolean {
  const leftFields: Readonly<Record<string, unknown>> = left;
  const rightFields: Readonly<Record<string, unknown>> = right;
  const keys = Object.keys(leftFields);

  return keys.length === Object.keys(rightFields).length &&
    keys.every((key) => leftFields[key] === rightFields[key]);
}
