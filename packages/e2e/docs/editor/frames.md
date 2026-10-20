# Editor frames

- `nextFrames(page, count = 2)`: resolves after `count` runtime updates. It
  waits on the runtime, not `requestAnimationFrame`: with a frame cap most
  animation frames render nothing. Throws when the editor runs without a
  runtime.
