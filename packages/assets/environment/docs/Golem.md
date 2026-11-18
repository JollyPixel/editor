# Golem

`@jolly-pixel/asset.environment/golem` lets a golem open `environment` assets. Its `GOLEM_KINDS` export is what `@jolly-pixel/golem` imports for the kind when the studio lists this package; `golem.open(assetId, "environment")` then returns the class below. Importing the entry adds the kind to the `GolemAssets` interface of `@jolly-pixel/golem.kit`, which types that call.

An agent reaches the same edits through the MCP server: `asset_open` answers the guide in `src/golem/guide.md` and the intents below with their input schema, and `asset_intent` runs one.

## Intents

- `change`: runs the method of the same name with its input and answers the sections that changed.

## `EnvironmentAsset`

The asset for `environment`: the sky, sun, ambient light, reflections, fog, tone mapping, glow and voxel shading a scene renders in. Its one command, `environment-changed`, replaces whole sections. The studio arbitrates by section, so a person editing another section keeps their change.

```ts
const environment = await golem.open(assetId, "environment");
await environment.change({ preset: "day", fog: { kind: "exp2", density: 0.03 } });
await environment.settled();
```

### `read(): EnvironmentFile`

A copy of the file.

### `change({ preset?, ...patch }): Promise<EnvironmentSection[]>`

Merges each section given (`sky`, `sun`, `ambient`, `reflections`, `fog`, `toneMapping`, `glow`, `voxel`) into the current one and sends one command holding only the sections that differ. It returns those sections, and sends nothing when none differs.

- A new `kind` for `sky` or `fog`, or a `sun` or `glow` that was `null`, starts from the defaults the environment editor uses. `null` turns `sun` or `glow` off.
- `preset` (`default`, `studio`, `day` or `night`) makes every section start from that preset instead of the current file.
- A field the section's kind does not have (`density` on a `linear` fog) throws `TypeError`, and a value the command schema rejects throws `CommandInvalidError`, both before anything is sent.

### Focus

None: the environment editor shows no peer focus.

## How it works

- `EnvironmentAsset.change` merges a partial patch into whole sections before sending, because `environment-changed` replaces each section it sets. A kind switch starts from `EnvironmentSwitch`, the defaults the environment editor uses, and a patch field missing from that start (`density` on a `linear` fog) throws, because the command schema would drop it silently. `apply` checks the values against the command schema. It sends only the sections that differ, which leaves a person's concurrent edit of another section alone.
