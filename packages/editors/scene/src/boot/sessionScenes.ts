// Import Third-party Dependencies
import type { SceneDocumentKind } from "@jolly-pixel/asset.scene/client";
import type {
  EditorAccess,
  EditorSession
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  SCENE_CAPABILITY_TABLE,
  SceneAccess
} from "../access/SceneAccess.ts";
import type { SceneLeaser } from "../scene/PrefabScenes.ts";

export function sessionScenes(
  session: Pick<EditorSession, "assets">,
  kind: SceneDocumentKind,
  access: Pick<EditorAccess, "follow">
): SceneLeaser {
  return (sceneId) => {
    const lease = session.assets.open(kind, sceneId);
    const grants = access.follow(lease.room, SCENE_CAPABILITY_TABLE);

    return {
      document: lease.document,
      ready: lease.ready,
      access: new SceneAccess(grants),
      release: () => {
        grants.dispose();
        lease.release();
      }
    };
  };
}
