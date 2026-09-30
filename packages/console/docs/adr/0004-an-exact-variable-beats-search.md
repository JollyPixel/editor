---
status: accepted
---

# An exact variable match beats search

One prompt serves three modes: `/` starts a command, a first token that resolves exactly to a
variable reads or writes it, and anything else searches. The classifier runs on every keystroke,
and the mode decides what the suggestions show and what Enter does.

A variable that resolves exactly always wins over search. `brush.si` searches, Enter inserts
`brush.size`, and the next Enter reads it. Reading a value by its full name takes one Enter.

The price is that a root variable makes its own name unsearchable: with a root `fps`, typing `fps`
reads it. A leading `?` forces search, and registrants keep root variables to a small deliberate
set, today the host's `theme` alone.

## Considered Options

- **A prefix for variables**, like `$brush.size`. It would free every word for search and cost a
  character on the most common input.
- **Search first, variables on a second Enter.** Reading a value would always take two steps, even
  when the name is typed in full.

## Consequences

In command mode an unknown command prints an error and never falls back to search, so a typo in
`/brush.grwo 2` cannot run the closest match.
