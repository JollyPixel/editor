// Import Internal Dependencies
import type {
  SceneAnchorFile,
  Vector3JSON
} from "../SceneFile.ts";

export interface ComponentAnchorPose {
  /**
   * Relative to the component's actor, in world units.
   */
  position: Vector3JSON;
  /**
   * Euler angles in degrees, XYZ order.
   */
  rotation: Vector3JSON;
}

export interface ComponentAnchor {
  /**
   * Unique within the component, and stable across edits of the asset.
   */
  key: string;
  label: string;
  /**
   * What the anchor stands for in the asset, such as "layer" or "object".
   */
  kind: string;
  pose: ComponentAnchorPose;
}

export interface ComponentAnchors {
  list(): Iterable<ComponentAnchor>;
  subscribe(
    listener: () => void
  ): () => void;
}

export interface SceneActorAnchor {
  component: string;
  anchor: ComponentAnchor;
}

export interface SceneAnchorsReader {
  anchors(
    actorId: string
  ): IterableIterator<SceneActorAnchor>;
  findAnchor(
    actorId: string,
    anchor: SceneAnchorFile
  ): ComponentAnchor | null;
}
