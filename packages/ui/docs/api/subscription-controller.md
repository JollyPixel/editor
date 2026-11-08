# `SubscriptionController`

`SubscriptionController` holds one source object for a Lit host and keeps the
host subscribed to it while the host is connected. Subscriptions are released
when the host disconnects or a new source is attached, and opened again when
the host reconnects.

```ts
import { SubscriptionController } from "@jolly-pixel/ui";

new SubscriptionController<TSource>(
  host: ReactiveControllerHost,
  subscribe?: SourceSubscriber<TSource>
)

type SourceSubscriber<TSource> = (
  source: TSource
) => Iterable<() => void>;
```

```ts
interface SubscriptionController<TSource> {
  readonly current: TSource | null; // null before the first attach()
  readonly attached: TSource; // throws before the first attach()
  attach(source: TSource): void;
}
```

- `attach()` stores the source, releases the previous subscriptions,
  subscribes when the host is connected, then calls `host.requestUpdate()`.
  It does not compare sources: attaching the same one resubscribes.
- `subscribe` runs on every connect and every `attach()` while connected. Each
  returned function is called once on release.
- Without `subscribe`, the controller is a plain holder that repaints the
  host on `attach()`.
- The source stays attached across a disconnect.

```ts
@customElement("width-editors")
export class WidthEditors extends LitElement {
  #locks = new SubscriptionController<FieldLockSource>(this, (locks) => {
    return [
      locks.subscribe(() => this.requestUpdate())
    ];
  });

  set fieldLocks(
    locks: FieldLockSource
  ) {
    this.#locks.attach(locks);
  }

  override render() {
    const editors = this.#locks.current?.editors("map.width").length ?? 0;

    return html`${editors} editing`;
  }
}
```

Read `attached` in code that only runs once a source is known, such as event
handlers wired by `render()` after the host received it.
