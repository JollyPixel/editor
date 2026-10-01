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
current frame. It also runs key-chord bindings.

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

### Editable target

An `input`, `textarea`, or content-editable element in the event's composed
path. `Keyboard` ignores keydowns and keypresses from it, so typing in a field
neither moves the player nor fires bindings.

### Guard

A `KeyboardGuard` added with `addGuard()`. While its `blocks()` returns true
for an event, `Keyboard` ignores that event as it would an editable target.
An open dialog uses one to take keys away from the canvas.

### Suspension

A pause taken with `Keyboard.suspend()`. The keyboard resets and ignores key
events until every suspension is released. Unlike `enabled`, several owners
can suspend at once.

## Keys and chords

### Key code

A `KeyboardEvent.code` value such as `"KeyW"`, `"Digit1"`, or `"Enter"`. It
names a physical position, not a character: `"KeyQ"` is the key printed A on
AZERTY. Polling queries take key codes; `"W"` and `"7"` are shorthands for
`"KeyW"` and `"Digit7"`.

### Key chord

A string naming one key and its modifiers, such as `"Mod+Shift+z"`. Modifiers
come first, in the order `Mod+`, `Shift+`, `Alt+`. `KeyChord` parses, matches,
and labels it.

### Physical chord / Letter chord

The two kinds of key a chord can name. A **physical chord** ends in a key code
(`"KeyQ"`) and matches that position on every layout. A **letter chord** ends
in a lowercase letter (`"q"`) and matches the key printed with that letter on
the user's layout. A `KeyChord` holds exactly one of `code` and `key`.

### Spatial binding / Mnemonic

The two reasons to pick a chord kind. A **spatial binding** depends on where
keys sit relative to each other, such as WASD or Q/E rotation, and uses
physical chords. A **mnemonic** depends on the letter's meaning, such as
Ctrl+Z for undo or R for replace, and uses letter chords.

### Mod

The platform's primary shortcut modifier: Command on Apple platforms, Control
elsewhere. The other of the two must be released for a chord to match.

### Exact modifiers

A chord matches only when the held modifiers are exactly the ones it names:
`"g"` does not match Shift+G. Shift and Caps Lock do not change the letter
itself, so `"Mod+Shift+z"` is Ctrl+Shift+Z.

### Letter fallback

How a letter chord resolves on a layout without Latin letters. When
`event.key` is not `a` to `z`, the letter is taken from the key position
instead, so `"Mod+z"` still works on a Cyrillic layout.

### Keyboard layout

A map from key codes to the characters printed on the user's keycaps, loaded
with `loadKeyboardLayout()`. It resolves to `null` where the browser cannot
report it. Browsers do not announce layout changes, so callers reload it when
the window regains focus.

### Label

The text `KeyChord.format()` writes for a tooltip: `"Ctrl+Shift+Z"`, or
`"⇧⌘Z"` on Apple platforms. A physical chord prints its QWERTY character
unless a keyboard layout is passed.

## Bindings

### Binding

A handler registered with `Keyboard.bind()` or `KeyBindings.bind()` for one or
more chords. It runs on a matching keydown, not during `update()`.

### KeyBindings

The registry behind `Keyboard.bind()`. It indexes bindings by key code and by
letter, and `dispatch()` runs them for one keydown. It can be used on its own
for keydowns that do not come from a `Keyboard`.

### Priority

The order in which matching bindings run: highest `priority` first, then
registration order.

### Handled / Passed on

A handler that returns `false` passes the key on to the next matching
binding. Any other return value handles it: later bindings are skipped and the
event gets `preventDefault()`.

### Repeat

Whether a binding also runs on auto-repeated keydowns. It is off by default.

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
