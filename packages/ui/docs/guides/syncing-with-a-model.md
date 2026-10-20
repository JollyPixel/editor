# Keeping an element in sync

A panel that reads its model in `render()` must render again when the model
changes elsewhere: undo, a peer, another panel. `SubscriptionController`
listens to the model for as long as the panel is connected.

## 1. Subscribe to a model property

```ts
import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SubscriptionController } from "@jolly-pixel/ui";

@customElement("layer-summary")
export class LayerSummary extends LitElement {
  @property({ attribute: false })
  declare layers: LayerStore | null;

  #layers = new SubscriptionController<LayerStore | null>(
    this,
    (layers) => (layers === null ?
      [] :
      [layers.subscribe("change", () => this.requestUpdate())])
  );

  constructor() {
    super();
    this.layers = null;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("layers")) {
      this.#layers.attach(this.layers);
    }
  }

  override render() {
    return html`${this.layers?.count ?? 0} layers`;
  }
}
```

- The callback returns the functions that undo its subscriptions. They run
  when the panel disconnects or another model is attached.
- Reconnecting the panel, such as a pane moved to another dock, subscribes
  again. The model stays attached in between.
- `attach()` does not compare models: attaching the same one subscribes
  again. Calling it from `willUpdate` behind `changed.has()` attaches once
  per new value.

## 2. Listen with `on` and `off`

A source with an `on`/`off` pair returns the matching `off`:

```ts
#presence = new SubscriptionController<PresenceSource>(this, (presence) => {
  const repaint = () => this.requestUpdate();
  presence.on("change", repaint);

  return [
    () => presence.off("change", repaint)
  ];
});
```

## 3. Several sources

Use one controller per source. Each one releases its own subscriptions:

```ts
#settings = new SubscriptionController<SculptSettings | null>(this, (settings) =>
  settings === null ? [] : [settings.subscribe("change", () => this.requestUpdate())]
);
#history = new SubscriptionController<History | null>(this, (history) =>
  history === null ? [] : [history.subscribe("change", () => this.requestUpdate())]
);

protected override willUpdate(
  changed: PropertyValues<this>
): void {
  if (changed.has("settings")) {
    this.#settings.attach(this.settings);
  }
  if (changed.has("history")) {
    this.#history.attach(this.history);
  }
}
```

## 4. Reading the attached source

- `current` is `null` before the first `attach()`.
- `attached` throws before it. Read it in event handlers that only exist once
  the source is known.
- Without a callback, the controller only holds the source and renders the
  host on `attach()`.

## With `FieldBinding`

The two work together. `FieldBinding` reads the model on every render, and
`SubscriptionController` makes sure a render follows each change. Fields in
the panel then show remote edits without extra code. See
[Building an inspector](./building-an-inspector.md).
