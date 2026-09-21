---
status: accepted
---

# A declarative binding reads through to its source and keeps no mirror

Editors write Lit templates (ADR-0001), so the facade's `addBinding` is unavailable to them, and
each field costs a `@state` field, a seeding branch in `willUpdate`, a `.value=` expression, and one
handler per event. `voxel-map` alone pays it 36 times. `FieldBinding` is the template-side
counterpart: a host plus a `{ read, write }` source, exposing `value`, `input` and `commit`.

```ts
#grid = new FieldBinding(this, {
  read: () => this.workspace.gridRenderer.visible,
  write: (value) => this.workspace.gridRenderer.setVisible(value)
});

render() {
  return html`
    <jolly-checkbox
      label="Grid visibility"
      .value=${this.#grid.value}
      @jolly-change=${this.#grid.commit}
    ></jolly-checkbox>
  `;
}
```

It holds no copy of the value. `value` calls `read()` on every render, and a committed edit calls
`write()` then `requestUpdate()`, so the next render reads back whatever the store actually accepted.
A source that clamps, rejects or rewrites an edit therefore wins without the consumer writing a
rollback, which is ADR-0002's contract expressed for templates rather than a second one beside it.

`write` receives `last`, matching `BindingChangeEvent`: `false` from `jolly-input`, `true` from
`jolly-change`. A template that only wants committed edits binds `commit` alone and never sees the
continuous stream. A detail carrying no `value` is ignored rather than written through, because the
handlers are bound in a template where nothing stops them being attached to another event.

A math source must return a fresh snapshot from `read()`. ADR-0021 makes vector values immutable and
compared component-wise, so the bound object compares equal to itself and the field never repaints.
The facade solves this inside `Binding.refresh()` (ADR-0027); here it is the source's job, because
the source, not the binding, decides what the store holds.

It is a plain object taking a `ReactiveControllerHost`, not a `ReactiveController`. It has no
lifecycle to run, and registering one that does nothing would imply a subscription it does not own.
Stores stay the host's business.

## Considered Options

- **A `bind(object, key)` directive.** A directive owns one expression, so it can set `.value` or
  listen, not both, and the consumer still wires the other half. The pairing is the boilerplate.
- **A controller mirroring the value in `@state`.** Optimistic apply with no rollback: a source that
  clamps an edit is overruled until something else triggers a render, and ADR-0002 already rejected
  that for elements.
- **Binding an object and a property key, as `addBinding` does.** The properties editors bind are
  rarely plain: `setVisible()`, a mode derived from a boolean, a nested store. Accessors cover those
  and a key does not.
- **Reusing `Binding` from the facade.** It builds and owns an element. A template already has one.

## Consequences

Two binding surfaces exist, one per authoring style, sharing the dispatch-free half of the contract
but not code: `Binding` also picks and constructs the element, which a template does itself. The
dispatch table stays the facade's alone.

`FieldBinding` is a plain module, so it is unit tested directly, unlike the facade containers
ADR-0024 puts out of reach. A source carrying real logic follows it out of the component, into a
module the element composes: `objectSources.ts`, `layerSources.ts` and `pickerChange.ts` are driven
by fake ports in specs that never import the component around them.

Three shapes stay on hand-written handlers, and that is the decision rather than a backlog:

- **Fields repeated per row**, as in `CustomPropertiesEditor`. A binding is one per instance, and
  making N of them churn with the rows costs more than the handler it removes.
- **A value that reaches the field through a render parameter** rather than through the host, as in
  `BlockEditorDialog` and `TilesetEditDialog`. `read()` would re-derive what the caller already
  resolved, and the two would drift.
- **An event whose detail is not `{ value }`**, such as `jolly-heading-change`. The handlers ignore
  it by design, so there is nothing to bind.
