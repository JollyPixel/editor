// Import Third-party Dependencies
import type { EnvironmentFile } from "@jolly-pixel/asset.environment/server";

type File = EnvironmentFile;

export interface EnvironmentPatch {
  sky?: {
    kind?: File["sky"]["kind"];
    color?: string;
  };
  sun?: Partial<NonNullable<File["sun"]>> | null;
  ambient?: Partial<File["ambient"]>;
  reflections?: Partial<File["reflections"]>;
  fog?: {
    kind?: File["fog"]["kind"];
    color?: string;
    near?: number;
    far?: number;
    density?: number;
  };
  toneMapping?: Partial<File["toneMapping"]>;
  glow?: Partial<NonNullable<File["glow"]>> | null;
  voxel?: Partial<File["voxel"]>;
}
