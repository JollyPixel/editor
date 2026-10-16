---
"@jolly-pixel/network": patch
"@jolly-pixel/asset-server": patch
---

Update ata-validator to 1.53.0 and recompile the envelope validators.
A protocol that declares no message now rejects payloads without running the union validator.
