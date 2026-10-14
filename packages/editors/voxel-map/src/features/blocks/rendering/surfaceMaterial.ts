// Import Third-party Dependencies
import * as THREE from "three";
import type {
  BlockSurface,
  MaterialGroupList
} from "@jolly-pixel/voxel.renderer";

export function surfaceSide(
  surface: BlockSurface
): THREE.Side {
  return surface.side === "double" ? THREE.DoubleSide : THREE.FrontSide;
}

export function createSurfaceMaterial(
  surface: BlockSurface,
  texture: THREE.Texture | null,
  materialGroups?: MaterialGroupList
): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
  const options = {
    map: texture,
    side: surfaceSide(surface),
    alphaTest: surface.alphaCutoff,
    transparent: surface.alphaMode === "blend",
    depthWrite: surface.alphaMode !== "blend"
  };
  const group = surface.materialGroup === undefined ?
    undefined :
    materialGroups?.get(surface.materialGroup);
  const material = group === undefined ?
    new THREE.MeshLambertMaterial(options) :
    new THREE.MeshStandardMaterial(options);
  group?.applyMaterialFinish(material);

  return material;
}
