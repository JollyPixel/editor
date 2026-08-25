---
status: accepted
---

# Expressions parsed by a closed grammar, never `eval`

Numeric fields accept arithmetic such as `1920/2`, evaluated by a tokenizer and shunting yard over
a deliberately small grammar: `+ - * /`, unary signs, parentheses, and number literals. `,` is
accepted as a decimal-separator alias, since no rule uses a comma and a French locale typing `1,5`
would otherwise get a parse error. Evaluation returns `{ ok: true, value } | { ok: false, error }`.

## Considered Options

- **Throwing from `evaluate`.** A malformed expression is expected user input; throwing puts a
  `try`/`catch` at every numeric commit.
- **Denylisting `eval`-shaped input.** Grammar closure rejects `alert(1)`, `constructor` and `a.b`
  inherently; a denylist invites the belief that the grammar is permissive.
