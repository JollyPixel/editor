# Architecture Decision Records

Decisions behind `@jolly-pixel/history` and the undo of the documents built on it. The concepts
are described in the [collaborative undo guide](../guides/collaborative-undo.md).

| # | Decision |
|---|---|
| [0001](./0001-history-is-its-own-workspace.md) | History is its own workspace, extracted together with a renderer |
| [0002](./0002-a-peer-edit-refuses-the-whole-step.md) | A peer edit refuses the whole step |
| [0003](./0003-one-guard-per-document-over-typed-keys.md) | One guard per document part, over typed written keys |
| [0004](./0004-a-rebase-is-a-rewind.md) | A rebase is a rewind, not a reload |
| [0005](./0005-every-answer-reaches-the-receipts.md) | Every answer of the server reaches the receipts |
| [0006](./0006-steps-open-across-calls.md) | Steps open across calls |
| [0007](./0007-texture-edits-record-into-build.md) | voxel-model texture edits record into the build scope |
| [0008](./0008-reconciler-revert-keeps-its-name.md) | `CommandReconciler.revert` keeps its name |
| [0009](./0009-renderers-emit-plain-changes.md) | Renderers emit plain changes; asset packages own their history |
