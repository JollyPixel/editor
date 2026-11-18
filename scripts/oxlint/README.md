# @jolly-pixel oxlint plugin

Local JS plugin loaded by the root `oxlint.config.ts`. Each rule enforces a line
of `.github/CODE_STYLE.md`. Tests live in `scripts/test/oxlint/rules/` and use
oxlint's `RuleTester`.

## Rules enabled everywhere

- `comment-format`: JSDoc blocks span three lines (autofixable), and comments
  contain no em dash.
- `err-declared-error`: the error passed to `Err()` is built in its own `const`.
- `errors-in-errors-folder` (`src/` only): classes extending `*Error` live in
  an `errors/` folder.
- `no-comments`: only import headers, `// CONSTANTS`, bare `eslint`/`oxlint`
  and `@ts-` directives, leading license blocks, JSDoc on interface or type
  literal properties, and a lone `@type`/`@satisfies` JSDoc tag. In `*.tst.ts`
  files, `@ts-expect-error` keeps the error fragment tstyche requires.
- `no-of-names`: no function or method named `of` or ending with `Of` or
  `For`. Name what it does instead.

`no-of-names` accepts `{ allow: string[] }`.

Empty `catch` blocks are allowed, since a comment can no longer explain them.
Empty functions are allowed in `test/` and `bench/` for fakes.

## `@openally` opt-in rules

`oxlint.config.ts` also enables the opt-in rules of
`@openally/config.oxlint`: `no-enum`, `no-ts-private`, `params-per-line` and
`no-get-set-prefix`. On top of its defaults, `kAccessorApis` allows the
Keyboard API and three.js renderer methods that `src/` interfaces mirror, and
`kFakeAccessorApis` adds the canvas and `AudioParam` methods that `test/` fakes
implement. Add a name only for a method an external API mandates, never for
new code.

## `unicorn/no-new-array`

`new Array(n)` is still the fastest way to preallocate an array that is filled
by index. Keep it on hot paths with a bare
`// oxlint-disable-next-line unicorn/no-new-array`. Elsewhere, use `[]` with
`push`, or `Array.from({ length }, fn)` for small one-time arrays.
`Array.from` is about 20 times slower per element.
