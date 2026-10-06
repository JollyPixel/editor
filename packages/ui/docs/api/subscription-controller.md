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

| Member | Behavior |
|---|---|
| `current` | The attached source, or `null` before the first `attach()`. |
| `attached` | The attached source. Throws if nothing is attached yet. |
| `attach(source)` | Stores `source`, releases the previous subscriptions, subscribes if the host is connected, then calls `host.requestUpdate()`. |

`subscribe` runs on every connect and every `attach()` while connected. It
returns the unsubscribe functions for what it opened; the controller calls
each of them once on release. It defaults to subscribing to nothing, which
leaves a plain holder that repaints the host on `attach()`.

`attach()` does not compare sources: attaching the same source again
resubscribes. The source stays attached across a disconnect.

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
