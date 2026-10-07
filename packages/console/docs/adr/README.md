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
| [0008](./0008-mirrored-variables-read-a-cached-value.md) | Mirrored variables read a cached value |
| [0009](./0009-revert-is-opt-in-per-command.md) | Revert is opt-in per command, and stale changes are skipped |
| [0010](./0010-scripts-edit-variables-as-ini-all-or-nothing.md) | Scripts edit variables as INI text, all or nothing |
| [0011](./0011-namespaces-nest-by-address.md) | Namespaces nest by dotted address, and parents are implicit |
| [0012](./0012-the-scope-is-a-prompt-view.md) | The scope is a view for the prompt, not registry state |
| [0013](./0013-list-items-are-space-separated-tokens.md) | List items are space-separated tokens |
