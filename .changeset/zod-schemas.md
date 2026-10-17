---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/accounts": patch
---

Schemas are written with zod instead of JSON Schema (`defineSchema` and `JSONSchema` are removed): Node validates them with ata-validator, browsers with zod. `withEvent` names a variant's event, `minProperties`/`dependentRequired`/`requiredAnyOf`/`notMultipleOf` cover rules zod cannot emit, and `ValidationError` keeps `instancePath` and `message` only.
Kind packages export a zod `optionsSchema`, and `ServerOptions.validateOutbound: false` names outbound messages from their tags without validating them.
