# saveFile

Downloads a blob in the browser under a file name.

```ts
saveFile(
  new Blob([bytes], { type: "audio/ogg" }),
  "door-slam.ogg"
);
```

```ts
function saveFile(
  blob: Blob,
  fileName: string
): void;
```

- The object URL is revoked on the next task, after the download started.
