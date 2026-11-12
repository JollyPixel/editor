// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import type {
  SceneActorJSON,
  SceneComponentJSON,
  SceneTransformJSON
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type {
  AssetRef,
  SceneRefs
} from "./SceneRefs.ts";

export interface ComponentSpec {
  type: string;
  /**
   * @default {}
   */
  data?: SceneComponentJSON["data"];
  /**
   * Each slot takes an asset id, a catalog path, `{ id, kind }` or `null`.
   * @default {}
   */
  assets?: Record<string, AssetRef>;
}

export interface ActorSpec {
  name: string;
  /**
   * @default true
   */
  visible?: boolean;
  /**
   * Missing fields take the identity: position and rotation 0, scale 1.
   */
  transform?: Partial<SceneTransformJSON>;
  components?: ComponentSpec[];
  children?: ActorSpec[];
}

export interface AddedActor {
  id: string;
  name: string;
}

export function actorList(
  spec: ActorSpec,
  parentId: string | null,
  refs: SceneRefs
): SceneActorJSON[] {
  const id = randomUUID();
  const actor: SceneActorJSON = {
    id,
    name: spec.name,
    parentId,
    visible: spec.visible ?? true,
    transform: {
      position: spec.transform?.position ?? vector(0),
      rotation: spec.transform?.rotation ?? vector(0),
      scale: spec.transform?.scale ?? vector(1)
    },
    components: (spec.components ?? []).map(
      (component) => componentJSON(component, refs)
    )
  };

  return [
    actor,
    ...(spec.children ?? []).flatMap(
      (child) => actorList(child, id, refs)
    )
  ];
}

export function componentJSON(
  spec: ComponentSpec,
  refs: SceneRefs
): SceneComponentJSON {
  return {
    id: randomUUID(),
    type: spec.type,
    data: spec.data ?? {},
    assets: Object.fromEntries(
      Object.entries(spec.assets ?? {}).map(
        ([slot, ref]) => [slot, refs.asset(ref)]
      )
    )
  };
}

function vector(
  value: number
): SceneTransformJSON["position"] {
  return {
    x: value,
    y: value,
    z: value
  };
}
