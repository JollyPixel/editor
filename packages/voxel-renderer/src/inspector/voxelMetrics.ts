// Import Internal Dependencies
import type { VoxelMeshInspector } from "./VoxelInspector.ts";
import type { VoxelMetric } from "./VoxelMetric.ts";

// CONSTANTS
const kGroup = "voxel";

export function voxelMetrics(
  inspector: VoxelMeshInspector
): readonly VoxelMetric[] {
  function stats() {
    return inspector.stats;
  }

  return [
    count("chunks", "chunks", () => stats().chunks),
    count("meshes", "meshes", () => stats().meshes),
    count("voxels", "voxels", () => stats().voxels),
    count("faces", "faces", () => stats().faces),
    count("meshTriangles", "mesh tris", () => stats().triangles),
    {
      id: "culledFaces",
      label: "culled",
      unit: "percent",
      better: "higher",
      group: kGroup,
      tile: false,
      sample: () => {
        const { faces, culledFaces } = stats();

        return share(culledFaces, faces + culledFaces);
      }
    },
    {
      id: "mergedFaces",
      label: "merged",
      unit: "percent",
      better: "higher",
      group: kGroup,
      tile: false,
      sample: () => {
        const { faces, mergedFaces } = stats();

        return share(mergedFaces, faces + mergedFaces);
      }
    },
    {
      id: "facesPerVoxel",
      label: "faces/voxel",
      unit: "decimal",
      better: "lower",
      group: kGroup,
      tile: false,
      sample: () => stats().facesPerSolidVoxel
    },
    {
      id: "buildTimeMs",
      label: "build time",
      unit: "ms",
      better: "lower",
      group: kGroup,
      tile: false,
      sample: () => stats().buildTimeMs
    }
  ];
}

function count(
  id: string,
  label: string,
  sample: () => number
): VoxelMetric {
  return {
    id,
    label,
    unit: "count",
    group: kGroup,
    tile: false,
    sample
  };
}

function share(
  part: number,
  total: number
): number {
  return total === 0 ? 0 : (part / total) * 100;
}
