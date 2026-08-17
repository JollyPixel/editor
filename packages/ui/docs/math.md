# Math

`jolly-vector2`, `jolly-vector3`, `jolly-vector4`, `jolly-quaternion`, `jolly-transform`, and
`jolly-point2d`. Structural types, no `three` dependency: `Vec3Like`, `QuatLike` and
`TransformLike` match `THREE.Vector3`, `THREE.Quaternion` and a one-line `Object3D` adapter
directly.

```ts
import type { Vec3Like } from "@jolly-pixel/ui";

el.value = mesh.position;
el.addEventListener("jolly-change", (event) => {
  mesh.position.copy(event.detail.value as Vec3Like);
});
```

## Per-axis Mixed

`Vector2`, `Vector3` and `Vector4` share `VectorField`, generic over an axis key list
(`["x","y"]`, `["x","y","z"]`, `["x","y","z","w"]`). Section 3's `Mixed` sentinel is all or
nothing; a vector applies it per axis instead, so editing one axis of a mixed selection commits
that axis and leaves the others mixed:

```ts
export type VectorValue<TAxis extends string> =
  | Record<TAxis, number>
  | Record<TAxis, FieldValue<number>>
  | typeof Mixed;
```

`<jolly-vector3 .value=${mesh.position}>` needs no wrapping; the per-axis record only appears
under a multi-selection where the axes disagree. `default` stays whole-value: one leading bar,
one revert action, every axis resets together.

Each axis box carries a small corner-color chip from `--jolly-axis-x`, `-y`, `-z`, `-w`, purely
a sighted-user accent. Axis identity is carried for real by `aria-label="X"` / `"Y"` / `"Z"` /
`"W"`, overridable per axis through `axisLabels` (`{ x: "pitch" }`) for domain terms.

## Quaternion and the Euler draft

`jolly-quaternion` edits Euler angles in degrees but its `value` stays `QuatLike`. Quaternion to
Euler has no unique inverse: several triples produce the same quaternion, and near a gimbal pole
a small quaternion change can jump the derived angles onto a different one.

The element keeps an internal Euler draft that survives across renders as long as converting it
back still equals the incoming `value`, within an epsilon — the user's own edits echoing back
through the controlled-element cycle. It re-derives fresh only on a genuine external change: a
peer edit, a revert, or an incoming value that no longer round-trips. Conversion order is
`"XYZ"`, matching `THREE.Euler`'s default, so round-tripping a mesh's rotation needs no explicit
order argument.

## Transform

`jolly-transform` composes `position` (`jolly-vector3`), `rotation` (`jolly-quaternion`) and
`scale` (`jolly-vector3`) as three independently labeled, independently lockable rows. It is a
plain element, not a field: locking, Mixed and revert are meaningful per sub-property, so there
is nothing for an outer wrapper spanning all three to add.

```ts
transform.value = {
  position: mesh.position,
  rotation: mesh.quaternion,
  scale: mesh.scale
};
transform.state = {
  rotation: { lockedBy: peer }
};
transform.addEventListener("jolly-change", (event) => {
  transform.value = event.detail.value;
});
```

`jolly-change`/`jolly-input` fire once per sub-row edit, carrying the whole merged
`TransformValue` back, so a consumer writes back one shape regardless of which row changed.

## Point2d's pad

`jolly-point2d` is not a third value shape: it reuses `Vector2`'s two-axis `VectorValue`, bounded
uniformly on both axes the way `jolly-slider` bounds a scalar (`min`, `max`, `step`). Where it
differs is the surface — a draggable pad instead of two axis boxes — and that difference removes
per-axis editing entirely: a drag always sets both axes at once, so, unlike `Vector2`, there is no
route to leaving one axis mixed while the other commits.

## Properties beyond the field contract

| Component | Property | Type | Default |
|---|---|---|---|
| `Vector2`/`3`/`4` | `step`, `min`, `max` | `number` | `0.1`, `-Infinity`, `Infinity` |
| `Vector2`/`3`/`4` | `axisLabels` | `Partial<Record<Axis, string>>` | `{}` |
| `Quaternion` | `step` | `number` (degrees) | `1` |
| `Quaternion` | `axisLabels` | `Partial<Record<"x"\|"y"\|"z", string>>` | `{}` |
| `Point2d` | `step`, `min`, `max` | `number` | `0.01`, `0`, `1` |
| `Transform` | `value`, `default`, `state` | see below | identity transform |
| `Transform` | `positionLabel`, `rotationLabel`, `scaleLabel` | `string` | `"Position"`, `"Rotation"`, `"Scale"` |

`Transform.state` carries per-row `lockedBy`, `peers`, `disabled`, `readonly` and `error`, since
those belong to `position`, `rotation` and `scale` individually rather than to the composite.

Neither `Vector4` nor `Point2d` has a named consumer today. Both ship for the API symmetry they
buy: `Vector4` shares literally all its code with `Vector2` and `Vector3`, and `Point2d`'s value
shape is `Vector2`'s.
