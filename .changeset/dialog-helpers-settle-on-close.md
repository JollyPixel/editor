---
"@jolly-pixel/ui": patch
---

Dialog helpers now resolve on `jolly-close` instead of `jolly-cancel`, so on Escape they resolve after focus has returned to the opener.
