# Controls glossary

This glossary defines the vocabulary for HTML5 input handling: devices,
composition, and per-frame state queries. Scene/ECS concerns (behaviors,
actors, cameras) belong to the engine's own glossary and consume this
vocabulary rather than extending it.

## Vocabulary

### Input

The composition root. Owns one instance of each device and handles what cuts
across all of them: connecting/disconnecting every device together, device
preference switching, and exit lifecycle. Per-device queries live on the
devices, not on `Input`.

### Device

Any of `Mouse`, `Keyboard`, `Gamepad`, `Touchpad`, `Screen` — a self-contained
input source that tracks its own state, exposes per-frame queries, and can be
constructed and driven standalone, without an `Input` instance.

### Mouse

The device tracking button state, canvas-local position, movement delta,
scroll wheel, double-click, and pointer lock.

### Keyboard

The device tracking per-key state (down, just pressed, just released,
auto-repeat) and text entered during the current frame.

### Gamepad

The device tracking up to four controllers: per-button state, per-axis state
with dead zone filtering, and axis auto-repeat for menu navigation.

### Touchpad

The device tracking up to ten simultaneous touch points and multi-finger
gesture helpers. Only receives events on touch-screen hardware — a laptop
trackpad's synthesized events are handled by `Mouse` instead.

### Screen

The device managing fullscreen state on the canvas: requesting, exiting,
tracking transitions, and exposing the canvas size.

### Adapter

The seam between a device and its real dependency (`CanvasAdapter`,
`DocumentAdapter`, `WindowAdapter`, `NavigatorAdapter`, `EventTargetAdapter`).
Devices depend on the adapter's narrow interface, not the concrete DOM API
directly, so they can be constructed and tested without a real browser.

### AtomicInput

A single evaluable condition binding one device action (a key, mouse button,
or gamepad button) to a state (`down` / `pressed` / `released`).

### CombinedInput

The composite condition layer built on `AtomicInput`: `AllInputs`,
`AtLeastOneInput`, `NoneInputs`, and `SequenceInputs`, plus the
`InputCombination` factory that builds them.

### InputCondition

The shared interface every atomic and composite condition implements:
`evaluate(input)` and `reset()`.

### AxisSource

A single contributor to an axis value: `ButtonAxisSource` (two conditions
driving `1` and `-1`) or `GamepadAxisSource` (one analog stick axis). Sources
produce values in `[-1, 1]` and have no axis-level scaling.

### Axis

One degree of freedom, resolving its sources to a single number in
`[-1, 1]` before `invert` and `scale`. With several sources bound, the one
with the largest magnitude wins. Equal sources pointing in opposite
directions cancel. Resolved axes do not nest as sources.

### AxisMap

A set of named axes sampled once per frame by `update(input)`, so every
consumer of a frame reads the same intent. Reports intent only: speed,
smoothing, and normalization belong to the consumer.

### InputActionQuery

The value object wrapping a query action (a real action, or the `ANY`/`NONE`
sentinel) and dispatching to the matching handler. Shared by `Mouse#isDown`/
`wasJustPressed`/`wasJustReleased` and their `Keyboard` equivalents.

## Important words

### Action

The argument passed to a per-frame query method — a specific key, mouse
button, or gamepad button/axis. For `Mouse` and `Keyboard`, an action may
also be one of the `ANY` / `NONE` sentinels instead of a specific value.

### ANY / NONE

The two sentinel actions `Mouse#isDown`/`wasJustPressed`/`wasJustReleased`
and their `Keyboard` equivalents accept alongside a real action: `"ANY"`
asks whether *some* tracked button/key satisfies the query, `"NONE"` asks
whether *none* do.

### Down / Just pressed / Just released

The three states a query can ask about a button or key. **Down** is a
continuous, level-triggered check (true for every frame it's held). **Just
pressed** / **just released** are edge-triggered — true only on the single
frame the transition happened, computed once per `update()` call.

### Viewport position / Viewport delta

Canvas-relative position or movement delta normalized to `[-1, 1]` on both
axes, with Y flipped so up is positive (game/NDC convention) — as opposed to
the raw, top-left-origin, pixel-space `position` / `delta`.

### World position

A viewport position scaled by half the canvas size: centered pixel
coordinates, rather than raw top-left-origin pixels or normalized `[-1, 1]`.

### Delta

Raw movement since the last `update()`, in canvas-local pixels, Y not
flipped. See **Viewport delta** for the transformed, game-convention form.

### Device preference

Which device family the player is currently driving input with: `"default"`
(mouse + keyboard) or `"gamepad"`. `Input` switches this automatically based
on which device was active most recently, and emits `devicePreferenceChange`.

### wasActive

A per-device flag, recomputed every `update()`, that's true if that device
registered any input during the current frame. Drives `Input`'s device
preference switching.

### Dead zone

The threshold below which a `Gamepad` analog stick axis reads as `0`,
filtering out drift and noise near the resting position.

### Auto-repeat

A synthetic "held" signal fired on an interval while a key or gamepad axis
stays pressed past an initial delay — distinct from the browser's native
key-repeat, which `Keyboard` also tracks separately via `autoRepeatedCode`.

### Pointer lock

The browser API (`Mouse#lock()` / `unlock()`) that captures the mouse cursor
inside the canvas and reports movement as unbounded deltas instead of
clamped screen position — used for first-person/free-look camera controls.

### Listener type

A dot-path string name for an event emitted across `Input` and its devices,
e.g. `"mouse.down"` or `"keyboard.KeyA"` — used to describe an event by name
rather than direct subscription, as `@jolly-pixel/engine`'s `@InputListener`
decorator does.
