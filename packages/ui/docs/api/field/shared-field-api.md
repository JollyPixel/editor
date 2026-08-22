# Shared field API

Text, numeric, choice, color, and vector fields inherit the same row state and
event contract.

The exported types are `FieldValue<T>`, `FieldAlign`, `FieldLabelPosition`,
and `JollyChangeDetail<T>`.

## Properties

| Property | Attribute | Type | Default |
|---|---|---|---|
| `label` | `label` | `string` | `""` |
| `description` | `description` | `string` | `""` |
| `value` | none | `T \| typeof Mixed` | Component-specific |
| `default` | none | `T \| undefined` | `undefined` |
| `error` | `error` | `string \| null` | `null` |
| `disabled` | `disabled` | `boolean` | `false` |
| `readonly` | `readonly` | `boolean` | `false` |
| `colored` | `colored` | `boolean` | `false` |
| `lockedBy` | none | `CollaboratorPresence \| null` | `null` |
| `peers` | none | `CollaboratorPresence[]` | `[]` |
| `align` | `align` | `"start" \| "end"` | `"start"` |
| `labelPosition` | `label-position` | `"inline" \| "top"` | `"inline"` |

`value`, `default`, `lockedBy`, and `peers` must be assigned as JavaScript
properties. `labelPosition="top"` places the label above the value area.

## Events

| Event | Detail | Timing |
|---|---|---|
| `jolly-input` | `{ value }` | Continuous interaction |
| `jolly-change` | `{ value }` | Committed value |

Both events bubble, cross shadow boundaries, and are not cancelable. A field
with no continuous gesture may emit only `jolly-change`.

## Mixed values

`Mixed` is the exported sentinel for a multi-selection without one value.
`isMixed(value)` narrows it. Fields render a mixed state and keep `value`
unchanged until an allowed edit commits a concrete value.

## Collaboration

`CollaboratorPresence` has `clientId`, `displayName`, `color`, and optional
`editing` fields. `lockedBy` makes the field read-only while keeping it
focusable. `peers` renders collaborator indicators. The package owns no
collaboration transport.
