# Lantern glossary

A tour walks a newcomer through an editor one step at a time. Each step dims
the page, lights up one part of the interface and explains it on a card. Once
the user finishes or skips the tour, the browser remembers it as **seen**.

Each term below describes the idea first. The *In code* line names where it
shows up in the API. The [architecture](./ARCHITECTURE.md) shows how the parts
fit together.

## Tours

### Tour

A guided walk through one editor, written by that editor's authors as a list
of steps. It is checked when it is declared, so a broken step fails the
editor's unit tests instead of a newcomer's first visit.

*In code:* [`Tour`](./docs/Tour.md). A broken declaration throws
`TourDefinitionError`.

### Step

One stop on a tour: a title, a short text, sometimes a picture, and usually a
part of the interface to point at. The user sees one step at a time and moves
with Next, Back or Skip.

*In code:* `TourStepOptions` in the declaration, `TourStep` once parsed, read
through `tour.steps`.

### Lantern

The tour runner of one page. It knows every tour the editor registered, runs
one at a time and remembers which ones the user has seen. It draws nothing: it
hands each run to the overlay.

*In code:* [`Lantern`](./docs/Lantern.md), with `register()` and `start()`. The
`present` option hands the run to the overlay. Inside an editor it is
`context.lantern`.

## Showing a step

### Target

The part of the interface a step points at: a button, a pane, a spot in the 3D
viewport. A step without one shows its card in the middle of the screen. A
target missing from the page is waited for briefly; after that the card is
centred, and the target is still lit if it shows up later.

*In code:* the step's `target`. A list of selectors becomes a
[`TargetPath`](./docs/Tour.md#targetpath), each selector searched inside the
previous match's shadow root. A function can return an element or an
`AnchorRect`. `run.seek()` decides, frame by frame, whether the card waits,
centres or lights the target.

### Spotlight

The dimmed page with a hole cut around the target. It sits above everything
else, floating panes included, and follows the target when it moves or
resizes.

*In code:* the [`jolly-lantern`](./docs/element.md) element. The dim colour is
`--jolly-dialog-backdrop`.

### Card

The box that explains the step: the tour title, the step counter, the picture,
the text and the buttons. It sits next to the hole on the side the step
prefers, or on the opposite side when it does not fit.

*In code:* the step's `side`, `"below"` by default.

### Preparing a step

Getting the interface ready before a step shows, so its target is visible:
opening a pane, expanding a folder, picking a tool. When the user leaves the
step, whichever button they press, the preparation can be undone.

*In code:* the step's `enter` hook and the cleanup it returns. Its `signal`
aborts when the step is left.

## Moving through a tour

### Passive step

A step the user only reads. The tour holds the keyboard, with the arrows to
move and Escape to skip, and the lit element cannot be clicked, so nothing
changes under the card.

*In code:* any step without `until`. The overlay pushes an `inputLayers` layer
and covers the hole with a transparent shield.

### Interactive step

A step that asks the user to do something, such as placing a block or orbiting
the camera, and moves on once they have. Next is disabled while it waits, and
the page gets clicks and keys again. A hook that fails moves on too, so it
cannot trap the user.

*In code:* the step's `until` hook. `run.waiting` is `true` meanwhile.

### Run

One run of a tour. It ends **finished** when the user goes past the last step,
or **skipped** when they press Skip or Escape; both mark the tour as seen. A
run cut short because another tour started or the editor released its tours is
**interrupted** and leaves the tour unseen.

*In code:* [`TourRun`](./docs/TourRun.md) and its `end` event, whose outcome
is `"finished"`, `"skipped"` or `"interrupted"`.

## Remembering

### Seen

A tour the user has finished or skipped in this browser. The browser stores
the tour's version with it, so raising the version makes the tour unseen again:
that is how a reworked tour reaches people who skipped the old one. The state
is not shared with the project or the other peers in a room.

*In code:* `lantern.seen` ([`LanternSeen`](./docs/Lantern.md#lanternseen)) and
`Tour.version`. `seen.forget()`, or `/tour.reset` in the console, makes tours
unseen.
