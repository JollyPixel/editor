---
"@jolly-pixel/console": minor
---

Namespaces nest by dotted address (`pixelart.keybinds`), with implicit parents; `RegisteredNamespace.name` is now the last part of the address.
Add `/cd` with `CommandConsole.scope`, `scoped` and `enter()`; the prompt shows the scope and `/help` and `/script` default to it.
