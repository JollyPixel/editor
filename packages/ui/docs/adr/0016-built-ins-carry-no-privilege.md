---
status: accepted
---

# Built-in metrics and icons carry no privilege over registered ones

Built-in metrics (`fps`, `ms`, `worstMs`, and `mb` where `performance.memory` exists) are registered
through the same `MetricDefinition` interface a consumer uses, and built-in glyphs through the same
`registerIcon`. Dogfooding the public interface is the only way to know it suffices.

`ui` ships only what it can compute without domain knowledge; anything renderer- or domain-specific
is contributed by the consumer, either pulled via `sample()` or pushed via `track()`. The icon name
type is `BuiltinIconName | (string & {})`, which keeps autocomplete on built-ins while accepting any
other name.

## Considered Options

- **Push-only metrics.** Every consumer re-implements the refresh-window accumulator, already
  duplicated three times in this repository.
- **A closed icon record.** `voxel-map`'s domain glyphs could not be used on a `JollyOption`, so `ui`
  would have to absorb a cube.
