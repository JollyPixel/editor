---
"@jolly-pixel/console": minor
---

Add the `/revert [count]` and `/script [namespace]` built-ins: variable writes and commands returning a revert function from `execute` can be undone, and `/script` edits variables as INI text saved all or nothing as one revert step.
The registry and its namespaces are iterable (entries carry `address` and `description`), `InputHistory` adds `browsing`, `size` and `stopBrowsing()`, and a throwing `get` no longer breaks a `ConsoleServer` snapshot.
Search and rendering allocate less per keystroke, and `scrollback` returns the same frozen array until it changes.
