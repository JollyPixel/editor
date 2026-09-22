# Controls glossary

Terms used when reading input from a canvas. The
[architecture](./ARCHITECTURE.md) shows how `Input`, devices, and browser
adapters fit together. The [API documentation](./README.md) lists methods and
types.

## Input and devices

### Input

Owns one instance of each device for a canvas. It connects and updates them
together, tracks device preference, and handles exit events. Device queries
remain on the devices themselves.

### Device

One of the five components owned by `Input`. Each can also be constructed and
connected on its own. `Mouse`, `Keyboard`, `Gamepad`, and `Touchpad` update their
state each frame; `Screen` manages fullscreen state separately.

### Mouse

Tracks buttons, canvas-local position, movement, scrolling, double-clicks,
and pointer lock.

### Keyboard

Tracks held keys, key transitions, auto-repeat, and text entered during the
current frame.

### Gamepad

Tracks up to four controllers, including their buttons and analog axes.

### Touchpad

Tracks up to ten simultaneous touches and multi-finger gestures on touch
screens. A laptop trackpad's mouse events are handled by `Mouse`.

### Screen

Manages fullscreen state and canvas size.

## Reading device state

### Action

A control passed to a device query, such as a key, mouse button, gamepad
button, or gamepad axis.

### ANY / NONE

Special actions accepted by mouse and keyboard button or key queries.
`"ANY"` asks whether at least one control matches the requested state;
`"NONE"` asks whether none do.

### Down / Just pressed / Just released

**Down** remains true while a button or key is held. **Just pressed** and
**just released** report transitions from the latest `update()` call.

### wasActive

An activity flag on `Mouse`, `Keyboard`, `Gamepad`, and `Touchpad` for the
latest update. `Input` uses these flags to change device preference.

### Device preference

The input family used most recently: `"default"` for mouse, keyboard, or
touch input, and `"gamepad"` for gamepad input. `Input` updates this value
automatically.

## Mouse movement and position

### Delta

Mouse movement since the last `update()`, measured in canvas-local pixels.
The Y axis points down.

### Viewport position / Viewport delta

Canvas-relative mouse position or movement normalized to `[-1, 1]` on both
axes. The Y axis points up.

### World position

Viewport position scaled by half the canvas size, giving centered pixel
coordinates.

### Pointer lock

Captures the mouse cursor for movement beyond the canvas bounds. `Mouse`
provides `lock()` and `unlock()` for this browser feature.

## Keyboard and gamepad behavior

### Auto-repeat

Repeated input while a key or gamepad direction stays held. `Keyboard`
reports browser key repeat; `Gamepad` generates repeated axis presses after
a delay.

### Dead zone

The area near a gamepad stick's resting position where `Gamepad` reports
zero, filtering small movements and drift.

## Combining controls

### InputCombination

Builds conditions from keyboard, mouse, and gamepad state. Conditions can
require several controls together, accept alternatives, exclude controls,
or match a sequence.

### AtomicInput

A condition for one device control and one state (`down`, `pressed`, or
`released`). It can be used alone or inside a combination.

### Held step

A step in an input sequence that must remain true while later steps are
matched. Releasing it rolls the sequence back to that step.

## Mapping axes

### AxisSource

One contribution to an axis value. A `ButtonAxisSource` reads conditions for
the positive and negative directions; a `GamepadAxisSource` reads an analog
stick axis.

### Axis

One scalar value resolved from its sources. When several sources are active,
the largest magnitude wins; equal sources in opposite directions cancel.

### AxisMap

A set of named axes sampled with `update(input)` once per frame. Consumers
read those values as movement intent and apply their own speed or smoothing.
