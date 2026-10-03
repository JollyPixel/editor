---
"@jolly-pixel/network": minor
---

Envelopes are parsed with `secure-json-parse` (dropping `__proto__` and `constructor.prototype` keys), and presence patches no longer use `Object.assign`.
`readCredential` throws the new `InvalidCredentialError` for a token that is not base64url UTF-8, rights patterns follow the documented rules (only `*` is special), and `ChannelTransportHost.close()` now closes client sockets with code `1001`.
