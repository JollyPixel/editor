---
"@jolly-pixel/asset": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/asset-source": major
"@jolly-pixel/controls": major
"@jolly-pixel/history": major
"@jolly-pixel/network": major
"@jolly-pixel/pixel-draw.renderer": major
"@jolly-pixel/three": major
"@jolly-pixel/ui": major
---

Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
The package docs list the new names; behavior is unchanged.
