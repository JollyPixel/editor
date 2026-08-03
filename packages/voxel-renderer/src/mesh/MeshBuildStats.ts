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
  /**
   * Vertex attributes emitted, in bytes per vertex — indices excluded. Read
   * off the geometries themselves, so shrinking or widening an attribute shows
   * up here whether or not anyone remembered to update the docs.
   */
  bytesPerVertex = 0;
  /** Wall-clock time spent in `buildChunkGeometries`. */
  buildTimeMs = 0;

  /**
   * Faces emitted per voxel that actually contributed geometry. Greedy meshing
   * drives this 3–20× below the naive path on terrain; if it does not, a merge
   * predicate has become too strict.
   */
  get facesPerSolidVoxel(): number {
    const solidVoxels = this.voxels - this.hiddenVoxels;

    return solidVoxels === 0 ? 0 : this.faces / solidVoxels;
  }

  reset(): void {
    this.voxels = 0;
    this.hiddenVoxels = 0;
    this.faces = 0;
    this.culledFaces = 0;
    this.mergedFaces = 0;
    this.vertices = 0;
    this.triangles = 0;
    this.geometries = 0;
    this.bytesPerVertex = 0;
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
    this.bytesPerVertex = source.bytesPerVertex;
    this.buildTimeMs = source.buildTimeMs;
  }

  clone(): MeshBuildStats {
    const stats = new MeshBuildStats();
    stats.copyFrom(this);

    return stats;
  }
}
