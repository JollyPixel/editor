---
"@jolly-pixel/runtime": minor
---

`MetricsPanelOptions` accepts a `signal`: aborting it unmounts the panel and clears `RuntimeMetrics.panel`.
A mount aborted before it resolves is dropped and the current panel stays in place.
