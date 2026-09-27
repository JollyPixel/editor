export interface MeshBuildCounts {
  voxels: number;
  hiddenVoxels: number;
  faces: number;
  culledFaces: number;
  mergedFaces: number;
  vertices: number;
  triangles: number;
  geometries: number;
  bytesPerVertex: number;
  bytes: number;
  buildTimeMs: number;
}

export class MeshBuildStats implements MeshBuildCounts {
  voxels = 0;
  hiddenVoxels = 0;
  faces = 0;
  culledFaces = 0;
  mergedFaces = 0;
  vertices = 0;
  triangles = 0;
  geometries = 0;
  bytesPerVertex = 0;
  bytes = 0;
  buildTimeMs = 0;

  get facesPerSolidVoxel(): number {
    const solidVoxels = this.voxels - this.hiddenVoxels;

    return solidVoxels === 0
      ? 0
      : this.faces / solidVoxels;
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
    this.bytes = 0;
    this.buildTimeMs = 0;
  }

  copyFrom(
    source: Readonly<MeshBuildCounts>
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
    this.bytes = source.bytes;
    this.buildTimeMs = source.buildTimeMs;
  }

  toJSON(): MeshBuildCounts {
    return {
      voxels: this.voxels,
      hiddenVoxels: this.hiddenVoxels,
      faces: this.faces,
      culledFaces: this.culledFaces,
      mergedFaces: this.mergedFaces,
      vertices: this.vertices,
      triangles: this.triangles,
      geometries: this.geometries,
      bytesPerVertex: this.bytesPerVertex,
      bytes: this.bytes,
      buildTimeMs: this.buildTimeMs
    };
  }

  clone(): MeshBuildStats {
    const stats = new MeshBuildStats();
    stats.copyFrom(this);

    return stats;
  }
}
