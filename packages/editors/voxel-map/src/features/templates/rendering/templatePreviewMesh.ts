// Import Third-party Dependencies
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  VoxelTransform,
  type MaterialGroupList,
  type VoxelTemplate
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { createSurfaceMaterial } from "../../blocks/rendering/surfaceMaterial.ts";
import { fitGeometry } from "../../preview/stage.ts";
import {
  buildTemplateBatches,
  type TemplateBatchSources
} from "./templateBatches.ts";

export interface TemplatePreviewMeshSources extends TemplateBatchSources {
  materialGroups?: MaterialGroupList;
}

export function buildTemplatePreviewMesh(
  template: VoxelTemplate,
  sources: TemplatePreviewMeshSources
): THREE.Mesh | null {
  const batches = buildTemplateBatches(
    template,
    VoxelTransform.Identity,
    sources
  );
  if (batches.length === 0) {
    return null;
  }

  const geometries = batches.map((batch) => batch.geometry);
  const geometry = mergeGeometries(geometries, true);
  for (const part of geometries) {
    part.dispose();
  }
  if (geometry === null) {
    return null;
  }
  fitGeometry(geometry);

  return new THREE.Mesh(
    geometry,
    batches.map((batch) => createSurfaceMaterial(
      batch.surface,
      batch.texture,
      sources.materialGroups
    ))
  );
}
