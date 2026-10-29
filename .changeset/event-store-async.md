---
"@jolly-pixel/event-store": major
---

Every reader, writer, `tags`, `compact` and `close` member returns a promise, and stores dispose with `await using` (`Symbol.asyncDispose`).
Writes run one at a time in call order and notify listeners before they resolve; an IndexedDB write resolves once its transaction committed.
