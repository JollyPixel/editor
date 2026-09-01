---
"@jolly-pixel/three": patch
---

Fix `ColoredOutlinePass` `priority` entries losing their outline ring entirely when fully enclosed inside a larger, nearer non-priority entry's silhouette (the ring had nowhere to paint even though priority already won the underlying mask color). A priority entry now also gets its own self-only mask/edge-detect chain, guaranteeing its ring always renders.
