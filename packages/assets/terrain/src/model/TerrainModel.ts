// Import Third-party Dependencies
import {
  Terrain,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TerrainMaterials,
  type TerrainMaterialsReader
} from "./TerrainMaterials.ts";

export interface TerrainModelReader {
  readonly terrain: TerrainReader;
  readonly materials: TerrainMaterialsReader;
}

export class TerrainModel implements TerrainModelReader {
  readonly terrain = new Terrain();
  readonly materials = new TerrainMaterials();

  clear(): void {
    this.terrain.clear();
    this.materials.clear();
  }
}
