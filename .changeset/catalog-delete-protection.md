---
"@jolly-pixel/asset-server": minor
---

Refuse `catalog:delete` while another asset still references the target, naming the dependents in the rejection reason.
A caller that warned its user resends with `force: true`; `catalogDeleteProtection: false` turns the check off, and `AssetWriter.remove` and reconciliation stay unguarded.
