# EditorLaunch

`EditorLaunch` names the asset an editor opens. Launch sources read it from
the page.

## API

```ts
class EditorLaunch {
  static parse(value: unknown): EditorLaunch | undefined;
  static fromTarget(target: unknown): EditorLaunch | undefined;
  static read(sources: Iterable<LaunchSource>): Promise<EditorLaunch>;

  readonly target: AssetId;

  constructor(target: AssetId);
}

interface LaunchSource {
  read(): Promise<EditorLaunch | undefined>;
}

function defaultLaunchSources(): LaunchSource[];
```

`parse` accepts an object with a `target` property. `fromTarget` accepts a
non-blank string. Both return `undefined` for anything else.

`read` asks each source in order and returns the first launch. It throws
`LaunchNotFoundError` when no source answers.

## Sources

`defaultLaunchSources()` returns the three built-in sources in this order.

```ts
class HostMessageLaunchSource implements LaunchSource {
  readonly timeout: number;

  constructor(options?: { timeout?: number; });
}

class QueryLaunchSource implements LaunchSource {
  readonly param: string;

  constructor(param?: string);
}

class InjectedLaunchSource implements LaunchSource {
  readonly elementId: string;

  constructor(elementId?: string);
}
```

| Source | Reads | Default |
|---|---|---|
| `HostMessageLaunchSource` | `{ type: "jolly-launch", target }` posted by `window.parent` | `timeout` 1000 ms |
| `QueryLaunchSource` | the query parameter `param` | `"target"` |
| `InjectedLaunchSource` | the JSON `<script>` element `elementId` | `LAUNCH_ELEMENT_ID` |

Outside a frame `HostMessageLaunchSource` answers `undefined` at once. It
ignores messages from other windows and messages of another `type`.
`InjectedLaunchSource` answers `undefined` for a missing element or malformed
JSON. The element is written by the asset workspace Vite plugin's `launch`
option.

`LAUNCH_MESSAGE_TYPE` and `LAUNCH_QUERY_PARAM` export the defaults.
