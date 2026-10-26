// Import Third-party Dependencies
import {
  Terrain,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TerrainLayers,
  type TerrainLayersReader
} from "./TerrainLayers.ts";

export interface TerrainModelReader {
  readonly terrain: TerrainReader;
  readonly layers: TerrainLayersReader;
}

export class TerrainModel implements TerrainModelReader {
  readonly terrain = new Terrain();
  readonly layers = new TerrainLayers();

  clear(): void {
    this.terrain.clear();
    this.layers.clear();
  }
}
