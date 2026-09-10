# API reference

Every element `@jolly-pixel/ui` exports, grouped by concern. Elements are the
public API: attributes, properties and events are the contract, internals are
not. See [the ADR index](../adr/README.md) for the reasoning behind that split.

## Interface

- [Containers](./containers/README.md) — panes, folders, docks, dialogs, tabs, toolbars, rails.
- [Controls](./controls/README.md) — the field elements: text, number, range, select, colour, flags.
- [Data](./data/README.md) — the tree element and its utilities.
- [Feedback](./feedback/README.md) — loading, progress and log surfaces.
- [Icon](./icon/README.md) — the icon element and its registry.
- [Theme](./theme/README.md) — scope hosts, tokens, theme and density controls.

## Runtime

- [Facade](./facade/README.md) — the imperative `Pane` API over the elements.
- [Monitors](./monitors/README.md) — read-only value displays and graphs.
- [Stats](./stats/README.md) — metric definitions and the recorder.
- [Peer](./peer/README.md) — the presence port and its sources.
- [Colour](./color/README.md) — colour helpers shared by the controls.
- [Storage](./storage/README.md) — the persistence port used for docking layouts.
- [Interaction](./interaction/README.md) — shortcuts and input scoping.

## Primitives

- [Math](./math/README.md) — the structural vector, quaternion and transform types.
- [Geometry](./geometry.md) — rectangles, placement and measurement helpers.
- [DOM](./dom.md) — the low-level DOM helpers the elements share.
- [Shared field API](./field/shared-field-api.md) — what every field element has in common.
