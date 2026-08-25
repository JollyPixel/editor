---
status: accepted
---

# `disabled`, `readonly` and `lockedBy` combine rather than override

Editability is `!disabled && !readonly && lockedBy === null`, and the three states render
independently. They mean different things and map to different accessibility semantics: `disabled`
is unfocusable and natively disabled, `readonly` is focusable with `aria-readonly`, and `lockedBy`
is focusable with `aria-disabled` plus the holder named.

## Considered Options

- **A precedence chain.** A locked field would stop showing that it is also disabled — the same
  failure as picking one visual channel by precedence (see ADR-0010's state channels).

## Consequences

A locked field never uses `inert`. It stays focusable so the value can be read and copied, and
assistive technology can announce the reason.
