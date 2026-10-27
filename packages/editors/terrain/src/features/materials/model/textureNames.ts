// Import Third-party Dependencies
import type { TerrainMaterialMapKind } from "@jolly-pixel/asset.terrain/client";

// CONSTANTS
const kMapSuffixes: Readonly<Record<TerrainMaterialMapKind, readonly string[]>> = {
  albedo: ["albedo", "basecolor", "basecolour", "diffuse", "diff", "color", "colour", "col"],
  normal: ["normal", "normalgl", "nrm", "nor", "norm"],
  orm: ["orm", "arm"],
  height: ["height", "displacement", "disp", "depth", "bump"]
};
const kSeparators = /[\s._-]+/;

export interface TextureName {
  readonly base: string;
  readonly map: TerrainMaterialMapKind | null;
}

export interface NamedFile {
  readonly name: string;
}

export interface MaterialFiles<TFile extends NamedFile> {
  readonly name: string;
  readonly maps: Partial<Record<TerrainMaterialMapKind, TFile>>;
}

export function parseTextureName(
  path: string
): TextureName {
  const stem = fileStem(path);
  const words = stem.split(kSeparators).filter((word) => word !== "");
  const last = words.at(-1)?.toLowerCase();
  const map = last === undefined ? null : mapOfSuffix(last);
  if (map === null || words.length < 2) {
    return { base: stem, map: null };
  }

  return { base: words.slice(0, -1).join(" "), map };
}

export function materialName(
  base: string
): string {
  const words = base.split(kSeparators).filter((word) => word !== "");
  if (words.length === 0) {
    return "Material";
  }

  const name = words.join(" ");

  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function groupMaterialFiles<TFile extends NamedFile>(
  files: Iterable<TFile>
): MaterialFiles<TFile>[] {
  const groups = new Map<string, {
    name: string;
    maps: Partial<Record<TerrainMaterialMapKind, TFile>>;
  }>();
  for (const file of files) {
    const { base, map } = parseTextureName(file.name);
    const key = base.toLowerCase();
    let group = groups.get(key);
    if (group === undefined) {
      group = { name: materialName(base), maps: {} };
      groups.set(key, group);
    }
    const kind = map ?? "albedo";
    group.maps[kind] ??= file;
  }

  return [...groups.values()];
}

export function sameMaterial(
  left: string,
  right: string
): boolean {
  return parseTextureName(left).base.toLowerCase() === parseTextureName(right).base.toLowerCase();
}

export function parentFolder(
  path: string
): string {
  const slash = path.lastIndexOf("/");

  return slash === -1 ? "" : path.slice(0, slash);
}

function fileStem(
  path: string
): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");

  return dot <= 0 ? name : name.slice(0, dot);
}

function mapOfSuffix(
  suffix: string
): TerrainMaterialMapKind | null {
  for (const [map, suffixes] of Object.entries(kMapSuffixes)) {
    if (suffixes.includes(suffix)) {
      return map as TerrainMaterialMapKind;
    }
  }

  return null;
}
