// Import Third-party Dependencies
import type { SceneAnchorJSON } from "@jolly-pixel/asset.scene/client";
import type { Emitter } from "@openally/emitt";

export interface ActorAnchor {
  ownerId: string;
  anchor: SceneAnchorJSON;
}

export type AnchorPicksEvents = {
  pick: (picked: ActorAnchor) => void;
};

export type AnchorPicks = Emitter<AnchorPicksEvents>;

export function actorAnchor(
  ownerId: string,
  anchor: Readonly<SceneAnchorJSON>
): ActorAnchor {
  return {
    ownerId,
    anchor: {
      component: anchor.component,
      key: anchor.key
    }
  };
}

export function actorAnchorKey(
  { ownerId, anchor }: ActorAnchor
): string {
  return `${ownerId}/${anchor.component}/${anchor.key}`;
}
