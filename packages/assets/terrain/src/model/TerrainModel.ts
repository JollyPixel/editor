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
import {
  TerrainPointsOfInterest,
  type TerrainPointsOfInterestReader
} from "./TerrainPointsOfInterest.ts";

export interface TerrainModelReader {
  readonly terrain: TerrainReader;
  readonly materials: TerrainMaterialsReader;
  readonly pointsOfInterest: TerrainPointsOfInterestReader;
}

export class TerrainModel implements TerrainModelReader {
  readonly terrain = new Terrain();
  readonly materials = new TerrainMaterials();
  readonly pointsOfInterest = new TerrainPointsOfInterest();

  clear(): void {
    this.terrain.clear();
    this.materials.clear();
    this.pointsOfInterest.clear();
  }
}
