---
status: accepted
---

# A tree swatch samples one editable property of its row

`TreeNode.swatch` is a `{ title, color?, ring? }` the row renders as one small
square after the detail and before the badges. It shows a sample of a single
property the row's object owns, such as a material or a colour: the fill is
`color`, any CSS colour, with a checkerboard showing through a translucent one,
and `ring` draws an outline in a second colour. A swatch without `color` is empty and only shows on
a hovered or selected row, where it invites setting the property.

Activating the swatch emits `jolly-activate-swatch` with `{ id }` and neither
selects nor renames the row. The tree does not know what the property is.

## Considered Options

- **Another badge.** A badge is display only (ADR-0030), and badges already
  carry peer presence in a collaborative outliner, so a sample drawn as one
  more dot would read as a collaborator.
- **Badges that can be clicked.** It would reopen ADR-0030 for every badge,
  while only the property sample has something behind it to edit.
- **Reusing `jolly-activate` with a target field.** It changes an existing
  event's detail for every consumer, and a row activation (double-click,
  Enter) and a swatch activation lead to different things.
- **An action button on the row.** A row shows state; actions belong to the
  row gestures and, later, a context menu. A sample the user can also click
  stays state first.

## Consequences

- The swatch is a real button with `tabindex="-1"` and `title` as its
  accessible name, like the visibility and lock toggles: the keyboard reaches
  the same editor through the row, not through the swatch.
- A row has at most one swatch. A second sampled property needs a new
  decision, not an array.
- Pressing on the swatch never starts a row drag and a double-click on it
  never renames, as for the other row buttons.
