---
status: accepted
---

# Layout persists through derived keys and a stated reconciliation algorithm

Layout state (folder order and expansion, dock size and collapse, floating position, size and
visibility) goes
through a two-method `StorageAdapter` port. The default wraps `localStorage` and degrades to memory
permanently on failure, at both points where it throws: reading the `window.localStorage` property
in a sandboxed iframe, and `setItem` raising `QuotaExceededError` long after construction succeeded.

Keys derive from tag name plus a slug of the label, with declaration order breaking ties, and an
explicit `key` always wins. The slug normalises rather than strips — NFD, drop combining marks,
lowercase, collapse non-alphanumerics — because a naive strip turns `"Rotation générale"` into
`rotation-g-n-rale` and gives `"Échelle"` and `"Echelle"` different keys for one label.

Reconciliation on load is stated as an algorithm, because "take their declared position" is ambiguous
once a list has been reordered: keep stored order for keys still present, drop stored keys that are
gone, then insert each present-but-unstored key immediately after its nearest surviving preceding
sibling. Derivation and reconciliation are both pure functions over strings, so both are unit-tested
without a DOM.

## Considered Options

- **Configuring a key per component.** Too heavy for the common case; the costs below are all
  recoverable by setting `key` explicitly.
- **Reordering by declaration index.** Inserting one control scrambles every saved position after it.
- **Auto keys from the label alone.** Duplicate labels collide silently.

## Consequences

Renaming a label or swapping a control's type drops that item's saved position. Occurrence suffixes
renumber: with two `Options` folders, deleting the *first* promotes the survivor to `…:options`,
inheriting the deleted item's saved position while its own entry is dropped as orphaned. "I removed
an unrelated folder and another one moved" is a confusing symptom, so it is recorded here rather than
discovered later. A development warning fires on a tie.
