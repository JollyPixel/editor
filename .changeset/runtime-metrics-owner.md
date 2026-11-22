---
"@jolly-pixel/runtime": major
---

`runtime.metrics` owns both displays: `statsHud` becomes `metrics.hud`, `mountMetricsPanel()` becomes `metrics.mountPanel()`, and metrics register on `runtime.stats` (`metrics.addSource`, `addMetric`, `removeMetric` and `track` are gone). `runtime.idle` is gone; read `runtime.loop.sleeping`.
`RuntimeCore.resolveCanvas`/`resolveCatalog` become the `resolveRuntimeCanvas` and `resolveRuntimeAssetCatalog` exports, `MetricsPanelKeyboard` is `RuntimeKeyboard`, and `RuntimeLogger` takes `warn` in place of `debug` and `isNamespaceEnabled`.
