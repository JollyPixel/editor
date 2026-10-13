# EditorLaunch

The target a page opens, with the tag it shows and the shell that framed it.
[`mountStandalone`](../editor/mountStandalone.md) reads it from the first launch source
that answers and passes it to `mount` as `context.launch`.

## Launch sources

1. `{ type: "jolly-launch" }` posted by the parent frame, read by
   [`HostMessageLaunchSource`](#hostmessagelaunchsource).
2. The `target` query parameter (`QueryLaunchSource`).
3. The JSON element injected by the `launch` option of the asset workspace
   Vite plugin, written by `launchElement({ target, credential })` from
   `@jolly-pixel/asset-server`.

The parent is always asked first. The `sources` option of `mountStandalone`
replaces the rest. A source returns `undefined` to pass:

```ts
interface LaunchSource {
  read(): Promise<EditorLaunch | undefined>;
}

const fromHash: LaunchSource = {
  async read() {
    return EditorLaunch.fromTarget(location.hash.slice(1));
  }
};

await mountStandalone(MyEditor, { sources: [fromHash] });
```

## EditorLaunch

```ts
class EditorLaunch {
  static parse(value: unknown, shell?: ShellChannel | null): EditorLaunch | undefined;
  static fromTarget(target: unknown, shell?: ShellChannel | null): EditorLaunch | undefined;
  static fromUrl(url: URL, param?: string): EditorLaunch | undefined;
  static read(sources: Iterable<LaunchSource>, logger?: HostLogger): Promise<EditorLaunch>;

  readonly target: AssetId;
  readonly tag: string | null;
  readonly shell: ShellChannel | null;
  readonly credential: string | null;

  viewing(tag: string | null): EditorLaunch;
  retarget(target: string, tag?: string | null): EditorLaunch;
  sameView(other: EditorLaunch): boolean;
  toUrl(href: string): URL;
}
```

### parse(value, shell?)

Reads an object with a non-blank `target` and an optional `credential`.

### fromTarget(target, shell?)

Reads a non-blank string.

### fromUrl(url, param?)

Reads `?target=` (or `param`) and `?tag=`.

### read(sources, logger?)

Returns the first launch a source answers. Throws `LaunchNotFoundError` when
none does.

### tag

The tag the page shows, `null` for the current version. Whatever source
answered, the launch takes the page URL's `?tag=` when its `?target=` names
the same asset, so a framed page keeps the tag of its frame URL. See
[tag views](../session/EditorToolbar.md#tag-views).

### credential

The share-link credential of an injected launch, `null` otherwise.

### viewing(tag) and retarget(target, tag?)

Copies with another tag or another target, keeping `shell` and `credential`.

### sameView(other)

`true` when both name the same target and tag.

### toUrl(href)

A `URL` of `href` with `?target=` and `?tag=` replaced, other parameters kept.

## HostMessageLaunchSource

```ts
new HostMessageLaunchSource({
  timeout?: number;
  origins?: Iterable<string>;
  logger?: HostLogger;
});
```

Posts `{ type: "jolly-ready" }` to the parent once per allowed origin, then
waits `timeout` milliseconds (1000 by default) for `jolly-launch`. A launch
from an origin outside `origins` (`[location.origin]` by default) is ignored;
`ANY_SHELL_ORIGIN` (`"*"`) allows every origin. A launch read this way carries
a [`ShellChannel`](./ShellChannel.md).
