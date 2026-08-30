export class MeshBuildStats {
  voxels = 0;
  hiddenVoxels = 0;
  faces = 0;
  culledFaces = 0;
  /**
   * Faces folded into neighbouring greedy quads; 0 when disabled.
   */
  mergedFaces = 0;
  vertices = 0;
  triangles = 0;
  geometries = 0;
  bytesPerVertex = 0;
  buildTimeMs = 0;

  /**
   * Faces emitted per voxel that contributed geometry.
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
