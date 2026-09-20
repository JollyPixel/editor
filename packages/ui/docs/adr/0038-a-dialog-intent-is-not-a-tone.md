---
status: accepted
---

# A dialog's intent is not a tone

`jolly-dialog` takes two colour inputs. `tone`, or the tone of its `icon`,
makes it a toned area exactly as ADR-0037 does for a pane: the dialog sets
`--jolly-area-tone` and `--jolly-area-fill` on itself, and because it is a
scope host its accent tokens follow. `intent` (`info`, `success`, `warning`,
`danger`) sets `--jolly-dialog-header-bg` from an `--jolly-intent-*-fill`
token and nothing else. An intent wins over a tone and drops the area.

## Considered Options

- **Express warning and danger as tones.** The seven hues were chosen to stay
  clear of the semantic ones; `coral` sits at 42 degrees so a toned header
  never reads as an error. A `danger` tone would undo that.
- **Let an intent retint the content too.** An amber accent button stops
  reading as the primary action, and a destructive action already has the
  `danger` button variant. The header states the intent; the actions keep
  their own meaning.
- **Keep both the area tone and the intent header.** A red header over teal
  focus rings and accent buttons carries two signals at once.

## Consequences

- The intent fills use the 700 stops of the semantic ramps, the lightest that
  hold white text; the 500 stops do not.
- `warning` and `danger` switch the native dialog to `role="alertdialog"`, and
  every intent has a default icon, so the intent never rests on colour alone.
  Under forced colours the fill is gone and the icon is all that remains.
- The backdrop is mixed from `--jolly-dialog-header-bg`, so it follows
  whichever of the accent, the tone or the intent painted the header.
- The header icon is drawn `on-fill` with its tone off, as in a toned pane: the
  fill already carries the hue.
- `showConfirm({ danger: true })` defaults to the `danger` intent, so existing
  destructive confirms changed appearance without a call-site edit.
- A dialog declared inside a toned pane inherits that pane's area, and an
  `info` intent there stays on the regular accent.
