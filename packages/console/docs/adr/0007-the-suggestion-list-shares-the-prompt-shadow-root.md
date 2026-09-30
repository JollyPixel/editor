---
status: accepted
---

# The suggestion list shares the prompt's shadow root

`jolly-console` is split along its concerns. The scrollback is its own element,
`jolly-console-log`, with its own shadow root and styles. The suggestion list and the keyboard are
reactive controllers, `SuggestionController` and `KeyboardController`, whose templates render
into the `jolly-console` shadow root.

The list cannot be a child element with a shadow root. The prompt is a combobox that points at the
list with `aria-controls` and at the highlighted option with `aria-activedescendant`. Both are
IDREFs, and an IDREF does not resolve across a shadow boundary, so screen readers would lose the
highlighted option. The scrollback has no such reference and can be encapsulated.

## Considered Options

- **A list element without a shadow root** (`createRenderRoot()` returning the host). The IDREFs
  would resolve, but the element would depend on styles from its parent, which is a component in
  name only.
- **Element reflection** (`ariaActiveDescendantElement`). It crosses shadow roots, but browser
  support is not complete enough to rely on for the one assistive path the combobox has.

## Consequences

List styles stay in `Console.styles.ts`. Controllers are tested under `node --test` with a stub
host; rendering, focus and scrolling are covered by the Playwright suite.
