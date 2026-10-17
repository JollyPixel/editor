# @jolly-pixel oxlint plugin

Local JS plugin loaded by the root `oxlint.config.ts`. Each rule enforces a line
of `.github/CODE_STYLE.md`. Tests live in `scripts/test/oxlint/rules/` and use
oxlint's `RuleTester`.

## Rules enabled everywhere

- `comment-format`: JSDoc blocks span three lines (autofixable), and comments
  contain no em dash.
- `err-declared-error`: the error passed to `Err()` is built in its own `const`.
- `no-enum`: no TypeScript `enum`.
- `no-ts-private`: `#private` members instead of the `private` modifier.
  `private declare` fields and `private constructor` stay allowed.
- `errors-in-errors-folder` (`src/` only): classes extending `*Error` live in
  an `errors/` folder.
- `no-comments`: only import headers, `// CONSTANTS`, bare `eslint`/`oxlint`
  and `@ts-` directives, leading license blocks, JSDoc on interface or type
  literal properties, and a lone `@type`/`@satisfies` JSDoc tag. In `*.tst.ts`
  files, `@ts-expect-error` keeps the error fragment tstyche requires.
- `no-of-names`: no function or method named `of` or ending with `Of` or
  `For`. Name what it does instead.
- `no-get-set-prefix`: no method named `getX`/`setX`. `override` methods and
  common Web APIs that test fakes implement are allowed.

`no-of-names` and `no-get-set-prefix` accept `{ allow: string[] }`.
`oxlint.config.ts` allows the published `engine` and `voxel-renderer`
accessors (`kPublicAccessors`); add a name there only for an existing public
API, never for new code.

Empty `catch` blocks are allowed, since a comment can no longer explain them.
Empty functions are allowed in `test/` and `bench/` for fakes.

## `unicorn/no-new-array`

`new Array(n)` is still the fastest way to preallocate an array that is filled
by index. Keep it on hot paths with a bare
`// oxlint-disable-next-line unicorn/no-new-array`. Elsewhere, use `[]` with
`push`, or `Array.from({ length }, fn)` for small one-time arrays.
`Array.from` is about 20 times slower per element.
