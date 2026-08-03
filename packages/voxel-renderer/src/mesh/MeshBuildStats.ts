/**
 * Counters gathered while meshing one chunk.
 */
export class MeshBuildStats {
  /** Voxels visited in the chunk, including those skipped afterwards. */
  voxels = 0;
  /** Voxels skipped because a higher-priority layer covers the position. */
  hiddenVoxels = 0;
  /** Faces written to a geometry buffer. */
  faces = 0;
  /** Faces skipped because an opaque neighbour occludes them. */
  culledFaces = 0;
  /**
   * Voxel faces greedy meshing folded into a neighbour's quad. Always 0 when
   * greedy meshing is off.
   */
  mergedFaces = 0;
  vertices = 0;
  triangles = 0;
  /** Geometries produced, one per tileset the chunk references. */
  geometries = 0;
  /** Wall-clock time spent in `buildChunkGeometries`. */
  buildTimeMs = 0;

  reset(): void {
    this.voxels = 0;
    this.hiddenVoxels = 0;
    this.faces = 0;
    this.culledFaces = 0;
    this.mergedFaces = 0;
    this.vertices = 0;
    this.triangles = 0;
    this.geometries = 0;
    this.buildTimeMs = 0;
  }

  copyFrom(
    source: MeshBuildStats
  ): void {
    this.voxels = source.voxels;
    this.hiddenVoxels = source.hiddenVoxels;
    this.faces = source.faces;
    this.culledFaces = source.culledFaces;
    this.mergedFaces = source.mergedFaces;
    this.vertices = source.vertices;
    this.triangles = source.triangles;
    this.geometries = source.geometries;
    this.buildTimeMs = source.buildTimeMs;
  }

  clone(): MeshBuildStats {
    const stats = new MeshBuildStats();
    stats.copyFrom(this);

    return stats;
  }
}
