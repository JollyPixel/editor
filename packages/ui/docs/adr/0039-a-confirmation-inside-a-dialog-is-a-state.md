---
status: accepted
---

# A confirmation inside a dialog is a state of that dialog

An action that needs confirming from inside an open `jolly-dialog` calls
`dialog.confirmInline()`. The dialog makes its body inert, hides the `actions`
slot and draws the message with its own Cancel and confirm buttons in the
footer. `showConfirm()` stays the helper for a confirmation raised from a pane,
a menu or a shortcut, where no dialog is open.

## Considered Options

- **Stack `showConfirm()` over the open dialog.** Two backdrops, two headers and
  two focus traps for one decision, and the second modal hides the usage figures
  the question is about.
- **Undo instead of confirm.** The better pattern, but it needs a history that
  covers the registries being edited and the deferred `jolly-toast`
  (ADR-0031). Neither exists yet.
- **A two-step or hold-to-confirm button.** Cheap, but it has no room for the
  consequence text and is weak from the keyboard.

## Consequences

- Escape and a backdrop click answer the confirmation with `false` and leave
  the dialog open; a second Escape dismisses the dialog as usual.
- Enter resolves to the confirm button while confirming, ahead of the slotted
  default action.
- Closing or disconnecting the dialog settles a pending confirmation with
  `false`, so an awaiting caller never hangs.
- The confirm button takes the focus, and the focus returns to the element that
  held it once the confirmation settles.
- The message carries `role="alert"`; the dialog's own role is unchanged.
- A consumer skips the call when the action loses nothing, and states the
  consequence next to the control when it can be known before the click.
