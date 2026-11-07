# Errors

Normalize a caught `unknown` value.

## `asError()`

```ts
function asError(error: unknown): Error;
```

Returns `error` itself when it is an `Error`, otherwise a new `Error` whose
message is `String(error)`.

## `errorMessage()`

```ts
function errorMessage(error: unknown): string;
```

The `message` of an `Error`, otherwise `String(error)`. Use it to show a
failure reason to the user or in a log line.

```ts
import { errorMessage } from "@jolly-pixel/utils";

try {
  await save();
}
catch (error) {
  notify(`Could not save: ${errorMessage(error)}`);
}
```
