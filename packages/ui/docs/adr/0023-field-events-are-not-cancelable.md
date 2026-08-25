---
status: accepted
---

# Field events are not cancelable, and carry the value alone

`jolly-input` fires continuously during interaction and `jolly-change` on commit; both bubble, are
composed, and carry `{ value }` and nothing else. Neither is cancelable: elements are forbidden from
mutating themselves (ADR-0002), so there is nothing for `preventDefault()` to prevent, and a
cancelable event that ignores cancellation is a trap.

A field's revert affordance is not a third kind of change — it commits `default` through
`jolly-change`, keeping one write-back path. Pane-level events (`jolly-reorder`, `jolly-revert`) carry
keys instead.

## Considered Options

- **A `source` discriminator on the change detail.** `jolly-input` against `jolly-change` already
  separates continuous from committed, which is the distinction consumers ask for.
- **The element writing its own `error`.** It would replace a consumer's validation message on the
  first typo and clear it afterwards, so the consumer cannot trust a property it set. Parse failures
  use a private `#parseError` that takes display precedence instead.
- **A `jolly-error` event with no local rendering.** Every numeric field needs the same write-back
  boilerplate, and forgetting it makes a typo do nothing at all.
