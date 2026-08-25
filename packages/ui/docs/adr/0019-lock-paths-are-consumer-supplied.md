---
status: accepted
---

# Lock paths are consumer-supplied, never derived

`path` is a plain property on every field, `null` by default, which opts the field out of locking.
Two clients must compute the same string, and a path derived from a label or a DOM position only
agrees while both render an identical tree — untrue as soon as a selection is involved, where the
domain id is knowledge only the consumer has.

## Considered Options

- **Deriving a path from the label or container chain.** Duplicate labels collide silently, and for a
  lock that means two unrelated fields locking each other across machines.
- **Consumers assigning `lockedBy` per field.** Twelve files instead of one, which is the same
  argument that put the field contract on a base class (ADR-0003).
