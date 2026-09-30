# Architecture Decision Records

Decisions behind `@jolly-pixel/console` that are hard to reverse or surprising without context. The
API is described in the [docs](../CommandConsole.md).

| # | Decision |
|---|---|
| [0001](./0001-no-singleton.md) | No singleton: one instance per editor page, passed down |
| [0002](./0002-the-core-has-no-dom.md) | The root entry has no DOM, and the element is a second entry |
| [0003](./0003-last-registration-wins.md) | The last registration wins, and a handle only removes its own |
| [0004](./0004-an-exact-variable-beats-search.md) | An exact variable match beats search |
| [0005](./0005-output-is-plain-text.md) | Output is plain text, and the console persists nothing |
| [0006](./0006-features-register-through-a-function.md) | Features register through a function over a context |
| [0007](./0007-the-suggestion-list-shares-the-prompt-shadow-root.md) | The suggestion list shares the prompt's shadow root |
