// Import Internal Dependencies
import type {
  AssetReferenceJSON,
  SceneActorView,
  SceneOverridesView
} from "../../network/types.ts";

type AssetSlotsView = SceneActorView["components"][number]["assets"];

export function actorReferences(
  actor: SceneActorView
): AssetReferenceJSON[] {
  return [
    ...actor.prefab === undefined ? [] : [actor.prefab],
    ...actorSlots(actor).flatMap(
      (assets) => Object.values(assets).filter((reference) => reference !== null)
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
    ...actor.overrides === undefined ? {} : { overrides: rebindOverrides(actor.overrides, idMap) },
    components: actor.components.map((component) => {
      return {
        ...component,
        assets: remapSlots(component.assets, idMap)
      };
    })
  };
}

function actorSlots(
  actor: SceneActorView
): AssetSlotsView[] {
  return [
    ...actor.components.map(({ assets }) => assets),
    ...Object.values(actor.overrides?.components ?? {}).flatMap(
      ({ assets }) => (assets === undefined ? [] : [assets])
    )
  ];
}

function rebindOverrides(
  overrides: SceneOverridesView,
  idMap: ReadonlyMap<string, string>
): SceneOverridesView {
  if (overrides.components === undefined) {
    return overrides;
  }

  return {
    ...overrides,
    components: Object.fromEntries(
      Object.entries(overrides.components).map(([path, entry]) => [
        path,
        entry.assets === undefined ? entry : {
          ...entry,
          assets: remapSlots(entry.assets, idMap)
        }
      ])
    )
  };
}

function remapSlots(
  assets: AssetSlotsView,
  idMap: ReadonlyMap<string, string>
): AssetSlotsView {
  return Object.fromEntries(
    Object.entries(assets).map(
      ([slot, reference]) => [slot, reference === null ? null : remapReference(reference, idMap)]
    )
  );
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
