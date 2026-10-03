---
"@jolly-pixel/console": minor
---

Add `ConsoleServer` and `ConsoleMirror` to serve a console's namespaces over a `MessagePort` and show them in another page's console.
A variable `set` may now return a promise, and `jolly-console` emits `opened` on its `CommandConsole` each time it shows.
