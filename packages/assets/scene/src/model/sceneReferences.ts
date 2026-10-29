// Import Internal Dependencies
import type {
  AssetReferenceJSON,
  SceneActorView
} from "../network/types.ts";

export function actorReferences(
  actor: SceneActorView
): AssetReferenceJSON[] {
  return [
    ...actor.prefab === undefined ? [] : [actor.prefab],
    ...actor.components.flatMap(
      ({ assets }) => Object.values(assets).filter((reference) => reference !== null)
    )
  ];
}

export function rebindActor(
  actor: SceneActorView,
  idMap: ReadonlyMap<string, string>
): SceneActorView {
  return {
    ...actor,
    ...actor.prefab === undefined ? {} : { prefab: remapReference(actor.prefab, idMap) },
    components: actor.components.map((component) => {
      return {
        ...component,
        assets: Object.fromEntries(
          Object.entries(component.assets).map(
            ([slot, reference]) => [slot, reference === null ? null : remapReference(reference, idMap)]
          )
        )
      };
    })
  };
}

function remapReference(
  reference: AssetReferenceJSON,
  idMap: ReadonlyMap<string, string>
): AssetReferenceJSON {
  return {
    ...reference,
    id: idMap.get(reference.id) ?? reference.id
  };
}
