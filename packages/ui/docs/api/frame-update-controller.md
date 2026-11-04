# `FrameUpdateController`

`FrameUpdateController` repaints a Lit host on the next animation frame. Use
it for a value that changes every frame, such as a playhead, where calling
`host.requestUpdate()` on each change would render more often than the screen
refreshes.

```ts
import { FrameUpdateController } from "@jolly-pixel/ui";

new FrameUpdateController(
  host: ReactiveControllerHost
)
```

```ts
interface FrameUpdateController {
  schedule(): void;
}
```

- `schedule()` asks for one `requestAnimationFrame()` and calls
  `host.requestUpdate()` in it. Calls made before that frame runs share it.
- A frame still pending when the host disconnects is cancelled.

```ts
export class Playhead extends LitElement {
  #frames = new FrameUpdateController(this);

  protected override updated(): void {
    if (this.player.playing) {
      this.#frames.schedule();
    }
  }
}
```
