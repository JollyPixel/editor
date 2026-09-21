---
"@jolly-pixel/voxel.renderer": minor
"@jolly-pixel/runtime": minor
"@jolly-pixel/ui": minor
---

Own performance metrics in the runtime: a subsystem describes what it counts
through the structural `MetricSource`, `runtime.metrics` registers it on one
recorder, and `mountMetricsPanel()` builds a dockable readout from them.
