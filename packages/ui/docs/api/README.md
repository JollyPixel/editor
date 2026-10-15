# API reference

Every element `@jolly-pixel/ui` exports, grouped by concern. Attributes,
properties and events are the contract; internals are not.

## Reading the property blocks

- Each element page lists its properties as a TypeScript interface.
- A property reflects the attribute of the same name, kebab-cased when the
  comment names it (`attribute min-size`). `property only` means there is no
  attribute.
- Booleans default to `false`, strings to `""`, unless a comment gives the
  default.

## Interface

- [Containers](./containers/README.md): panes, folders, docks, dialogs, tabs,
  toolbars, rails.
- [Controls](./controls/README.md): the field elements, buttons and hints.
- [Data](./data/README.md): the tree element and its utilities.
- [Feedback](./feedback/README.md): loading, progress, spinner and log.
- [Icon](./icon/README.md): the icon element and its registry.
- [Theme](./theme/README.md): scope hosts, tokens, theme and density controls.

## Runtime

- [Facade](./facade/README.md): the imperative `Pane` API over the elements.
- [Monitors](./monitors/README.md): read-only value displays and graphs.
- [Stats](./stats/README.md): metric definitions and the recorder.
- [Peer](./peer/README.md): the presence port and its sources.
- [Colour](./color/README.md): colour parsing and formatting.
- [Storage](./storage/README.md): the persistence port.
- [Interaction](./interaction/README.md): popovers, overflow titles, input
  layers and drag sessions.

## Primitives

- [Math](./math/README.md): the vector, quaternion and transform fields and
  their value types.
- [Geometry](./geometry.md): rectangles and anchored placement.
- [DOM](./dom.md): DOM guards and field event helpers.
- [Shared field API](./field/shared-field-api.md): what every field has in
  common.
- [`FieldBinding`](./field/field-binding.md): binds a field in a Lit template
  to one value.
- [Search queries](./search.md): `SearchQuery` and the `Searchable` hook.
- [`SubscriptionController`](./subscription-controller.md): keeps a host
  subscribed to one source while connected.
