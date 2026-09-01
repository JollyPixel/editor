# SelectionOverlayRegistry

Resolves a technique id (see [SelectionTechnique](./SelectionManager.md#selectiontechnique))
plus a target to the `SelectionOverlayFactory` that should build its overlay -
the open, registerable replacement for what used to be a hardcoded
`instanceof THREE.Mesh` switch inside `createSelectionOverlay`. This is what
makes `SelectionManager`'s per-object techniques (`"outline"`/
`"boundingBox"`, and anything else registered) pluggable per editor instead
of a closed set.

`@jolly-pixel/three` exports one pre-populated instance,
`defaultSelectionOverlayRegistry`, registered with every built-in technique -
`createSelectionOverlay` (used internally by `SelectionManager` and
`PeerSelectionOverlays`) always resolves against it. A caller wanting a
different or additional per-object technique registers its own
`SelectionOverlayFactory` into that same registry, or builds a separate
`SelectionOverlayRegistry` and resolves against that directly.

```ts
import * as THREE from "three";
import {
  defaultSelectionOverlayRegistry,
  type SelectionOverlayFactory,
  SelectionManager
} from "@jolly-pixel/three";

const wireframeTechnique: SelectionOverlayFactory = {
  id: "wireframe",
  supports: (target) => target instanceof THREE.Mesh,
  create: (target, options) => new MyWireframeOverlay({ target: target as THREE.Mesh, ...options })
};
defaultSelectionOverlayRegistry.register(wireframeTechnique);

const selection = new SelectionManager({ technique: "wireframe" });
selection.register("mesh-1", mesh); // now renders MyWireframeOverlay when selected
```

## SelectionOverlay

```ts
export interface SelectionOverlay {
  setColor(color: THREE.ColorRepresentation): void;
  setOpacity(opacity: number): void;
  setXray(xray: boolean): void;
  dispose(): void;
}
```

Common surface every per-object overlay technique implements -
[SelectionOutline](./SelectionOutline.md) and
[SelectionBoundingBox](./SelectionBoundingBox.md) both satisfy this already,
so a new technique only needs to match this shape, not extend a base class.

## SelectionOverlayCreateOptions

```ts
export interface SelectionOverlayCreateOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  linewidth?: number;
  fillOpacity?: number;
  xray?: boolean;
}
```

Forwarded by `createSelectionOverlay` to whichever factory's `create` is
resolved. `linewidth` is only meaningful to a technique that uses it
(`SelectionOutline`); `fillOpacity` likewise only to `SelectionBoundingBox` -
a technique that doesn't care about a field simply ignores it.

## SelectionOverlayFactory

```ts
export interface SelectionOverlayFactory {
  readonly id: string;
  supports(target: SelectableObject): boolean;
  create(target: SelectableObject, options: SelectionOverlayCreateOptions): SelectionOverlay;
}
```

- `id` - matched against a `SelectionManager`/`register` technique id.
- `supports(target)` - whether this technique can render `target` at all (e.g. `SelectionOutline` requires a `THREE.Mesh`).
- `create(target, options)` - only ever called with a `target` this factory's own `supports` already returned `true` for.

## SelectionOverlayRegistryOptions

```ts
export interface SelectionOverlayRegistryOptions {
  defaultId: string;
  fallbackId: string;
}
```

- `defaultId` - technique id resolved to when the requested id isn't registered (or its factory doesn't support the target) but some registered technique does. `defaultSelectionOverlayRegistry` uses `"outline"`.
- `fallbackId` - technique id resolved to as the last resort, once neither the requested id nor `defaultId` supports the target - typically the one technique that supports every target (`defaultSelectionOverlayRegistry` uses `"boundingBox"`).

## Methods

- `register(factory: SelectionOverlayFactory): void` - Registers `factory` under its own `id`, replacing any previously registered factory with the same id.
- `resolve(id: string, target: SelectableObject): SelectionOverlayFactory` - Resolves `id` + `target` to a factory. Three-tier order: the requested id if it supports `target`; else `defaultId` if it supports `target`; else `fallbackId`. Throws if `fallbackId` itself isn't registered.

## Built-in factories

`outlineOverlayFactory` (`"outline"`) and `boundingBoxOverlayFactory`
(`"boundingBox"`) are exported individually alongside
`defaultSelectionOverlayRegistry`, wrapping
[SelectionOutline](./SelectionOutline.md) and
[SelectionBoundingBox](./SelectionBoundingBox.md) respectively.
`boundingBoxOverlayFactory.supports` returns `true` unconditionally (it's the
universal fallback), but in practice it's only ever actually resolved to for
a target `outline` doesn't support (typically a `THREE.Group`) - a
`THREE.Mesh` can still be given `technique: "boundingBox"` explicitly to
force a box around it instead of an outline.

## Notes

- Opening this into a registry is a pure refactor of prior behavior for every id already in use: a `THREE.Mesh` given an unrecognized technique id still falls back to `"outline"` (via `defaultId`), and any non-mesh target still always renders `SelectionBoundingBox` (via `fallbackId`) - see [SelectionManager](./SelectionManager.md)'s own `SelectionTechnique` notes for why that fallback order matters for a per-id override that references a scene-level pipeline technique (`"highlight"`) instead of a per-object one.
- `createSelectionOverlay(target, options)` (unchanged call shape) is a thin wrapper around `defaultSelectionOverlayRegistry.resolve(options.technique, target).create(target, options)` - both `SelectionManager` and `PeerSelectionOverlays` keep calling it directly rather than the registry, so registering a new technique into `defaultSelectionOverlayRegistry` is picked up by both automatically.
