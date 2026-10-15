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
@customElement("peer-count")
export class PeerCount extends LitElement {
  #presence = new SubscriptionController<PresenceSource>(this, (presence) => {
    const repaint = () => this.requestUpdate();
    presence.on("change", repaint);

    return [
      () => presence.off("change", repaint)
    ];
  });

  set presence(
    presence: PresenceSource
  ) {
    this.#presence.attach(presence);
  }

  override render() {
    const peers = this.#presence.current?.peers.size ?? 0;

    return html`${peers} peers`;
  }
}
```

Read `attached` in code that only runs once a source is known, such as event
handlers wired by `render()` after the host received it.
