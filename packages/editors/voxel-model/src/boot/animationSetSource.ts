// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { EditorSession } from "@jolly-pixel/editor.host";
import {
  VOXEL_ANIMATION_EXTENSION,
  VOXEL_ANIMATION_KIND,
  type VoxelAnimationDocumentKind
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  AnimationSetRecord,
  AnimationSetSource
} from "../features/animation/index.ts";

// CONSTANTS
const kFolder = "animations";
const kPathSeparators = /[\\/]+/g;
const kOwnFallback = "Model animations";

export function sessionAnimationSets(
  session: EditorSession,
  kind: VoxelAnimationDocumentKind
): AnimationSetSource {
  const { catalog } = session;

  async function create(
    name: string
  ): Promise<AssetReferenceData> {
    const id = await catalog.create(setPath(name), null, {
      kind: VOXEL_ANIMATION_KIND,
      onConflict: "suffix"
    });

    return { id, kind: VOXEL_ANIMATION_KIND };
  }

  return {
    open: (id) => session.assets.open(kind, id),
    create,
    createOwn: () => create(baseName(catalog.record(session.target.record.id)?.source ?? kOwnFallback)),
    rename: (id, name) => catalog.rename(id, setPath(name)),

    records: () => [...catalog.records()]
      .filter((record) => record.kind === VOXEL_ANIMATION_KIND)
      .map((record): AnimationSetRecord => {
        return {
          id: record.id,
          kind: record.kind,
          name: setName(record.source)
        };
      }),

    usersOf: (id) => catalog.dependentsOf(id).length,

    subscribe(listener) {
      catalog.on("change", listener);
      catalog.on("dependencies", listener);

      return () => {
        catalog.off("change", listener);
        catalog.off("dependencies", listener);
      };
    }
  };
}

export function setName(
  source: string
): string {
  const file = source.split(kPathSeparators).at(-1) ?? source;

  return file.endsWith(VOXEL_ANIMATION_EXTENSION) ?
    file.slice(0, -VOXEL_ANIMATION_EXTENSION.length) :
    file;
}

function setPath(
  name: string
): string {
  const file = name.trim().replace(kPathSeparators, "-") || "Animation set";

  return `${kFolder}/${file}${VOXEL_ANIMATION_EXTENSION}`;
}

function baseName(
  source: string
): string {
  const file = source.split(kPathSeparators).at(-1) ?? source;

  return file.split(".")[0] || kOwnFallback;
}
