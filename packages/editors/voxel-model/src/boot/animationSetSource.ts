// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  CATALOG_CREATE,
  CATALOG_RENAME
} from "@jolly-pixel/asset-server/client";
import type {
  EditorAccess,
  EditorSession
} from "@jolly-pixel/editor.host";
import {
  VOXEL_ANIMATION_EXTENSION,
  VOXEL_ANIMATION_KIND,
  type VoxelAnimationDocumentKind
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  ANIMATION_SET_DEPENDENCY,
  type AnimationSetLease,
  type AnimationSetRecord,
  type AnimationSetSource
} from "../features/animation/index.ts";
import { ANIMATION_SET_CAPABILITY_TABLE } from "../access/AnimationSetAccess.ts";

// CONSTANTS
const kPathSeparators = /[\\/]+/g;
const kOwnFallback = "Model animations";

export function sessionAnimationSets(
  session: EditorSession,
  kind: VoxelAnimationDocumentKind,
  access: Pick<EditorAccess, "follow">
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

  function open(
    id: string
  ): AnimationSetLease {
    const lease = session.assets.open(kind, id);
    const grants = access.follow(lease.room, ANIMATION_SET_CAPABILITY_TABLE);

    return {
      document: lease.document,
      grants,
      release: () => {
        grants.dispose();
        lease.release();
      }
    };
  }

  return {
    open,
    create,
    createOwn: () => create(baseName(catalog.record(session.target.record.id)?.path ?? kOwnFallback)),
    rename: (id, name) => catalog.rename(id, setPath(name)),
    canCreate: () => catalog.can(CATALOG_CREATE),
    canRename: () => catalog.can(CATALOG_RENAME),

    records: () => [...catalog.records()]
      .filter((record) => record.kind === VOXEL_ANIMATION_KIND)
      .map((record): AnimationSetRecord => {
        return {
          id: record.id,
          kind: record.kind,
          name: setName(record.path)
        };
      }),

    countUsers: (id) => catalog.listDependents(id).length,

    subscribe(listener) {
      catalog.on("change", listener);
      catalog.on("dependencies", listener);
      catalog.on("rights", listener);

      return () => {
        catalog.off("change", listener);
        catalog.off("dependencies", listener);
        catalog.off("rights", listener);
      };
    }
  };
}

export function setName(
  path: string
): string {
  const file = path.split(kPathSeparators).at(-1) ?? path;

  return file.endsWith(VOXEL_ANIMATION_EXTENSION) ?
    file.slice(0, -VOXEL_ANIMATION_EXTENSION.length) :
    file;
}

function setPath(
  name: string
): string {
  const file = name.trim().replace(kPathSeparators, "-") || "Animation set";

  return `${ANIMATION_SET_DEPENDENCY.folder}${file}${VOXEL_ANIMATION_EXTENSION}`;
}

function baseName(
  path: string
): string {
  const file = path.split(kPathSeparators).at(-1) ?? path;

  return file.split(".")[0] || kOwnFallback;
}
