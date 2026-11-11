---
"@jolly-pixel/engine": minor
---

`@SceneProperty`, `@SceneActorComponent` and `@InputListener` now also work as standard decorators, storing their declarations in `Symbol.metadata` (defined when missing).
They return the new `BehaviorFieldDecorator` and `BehaviorMethodDecorator` types, which type-check under both decorator modes.
