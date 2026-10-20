<h1 align="center">
  editor.host
</h1>

<p align="center">
  Shared launch, session and runtime boot for JollyPixel editors
</p>

## 💃 Getting Started

This workspace-private package is never published. Add it as a dependency of
an editor workspace:

```json
{
  "dependencies": {
    "@jolly-pixel/editor.host": "workspace:*"
  }
}
```

## 💡 About

An editor opens one asset, its target. The host reads the target from the
page, connects a session to the asset server, leases the target's
dependencies with synced documents and hands the result to the editor's `mount`.

```mermaid
flowchart TB
    Launch["EditorLaunch"] --> Session["EditorSession"]
    Session --> Leases["AssetLeases"]
    Session -->|"mount(context)"| Editor["Editor class"]
    Editor --> Runtime["EditorRuntime"]
```

The [architecture guide](./ARCHITECTURE.md) shows each step as a diagram: the
boot sequence, how the target is found, lease sharing and what a failure
releases. The [glossary](./GLOSSARY.md) defines the vocabulary.

## 👀 Usage example

```ts
import {
  EditorRuntime,
  mountStandalone,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import {
  pixelArtDocumentKind
} from "@jolly-pixel/asset.pixel-art/client";

class MyEditor {
  static readonly accepts = "voxelmap";
  static readonly identity = { title: "Join voxel map" };
  static readonly kinds = [
    pixelArtDocumentKind()
  ];

  static createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime> {
    return EditorRuntime.create("#canvas", { logger });
  }

  static async mount(
    context: RuntimeEditorContext
  ): Promise<MyEditor> {
    await context.runtime.load(
      new MyScene(context.session.target.room)
    );

    return new MyEditor(context);
  }

  // ...

  dispose(): void {
    this.#panels.dispose();
  }
}

await mountStandalone(MyEditor, {
  dev: import.meta.env.DEV
});
```

## 📚 API

### Boot

- [`mountStandalone`](./docs/editor/mountStandalone.md): the editor definition and
  context, switching, page lifecycle, console and boot tracing.
- [`bootStandalone`](./docs/editor/bootStandalone.md): the offline fallback and
  offline mode.
- [`EditorLaunch`](./docs/launch/EditorLaunch.md): launch sources and the target, tag
  and shell of a page.
- [`ShellChannel`](./docs/launch/ShellChannel.md): the protocol between a shell and
  its editor frames.
- [`QueryParams`](./docs/params/QueryParams.md): typed query-string parameters.

### Session

- [`EditorSession`](./docs/session/EditorSession.md): the target room, live
  dependencies and their events.
- [`AssetLeases`](./docs/lease/AssetLeases.md): shared rooms and synced documents per
  asset.
- [`Archives`](./docs/session/Archives.md): `.zip` export, import and reset.
- [`EditorToolbar`](./docs/session/EditorToolbar.md): the bar above the viewport, its
  target picker and the tags of the target.

### Preferences

- [`Preferences`](./docs/preferences/Preferences.md): scope declarations, the
  overrides holder, its `localStorage` store, keybinding and camera helpers,
  and the host's scopes.

### Scene

- [`EditorRuntime`](./docs/runtime/EditorRuntime.md): runtime boot with the editor
  keyboard rules.
- [`PeerFrustums`](./docs/runtime/PeerFrustums.md): peer camera frustums as an actor
  component.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
pnpm --filter @jolly-pixel/editor.host test
pnpm run lint
```

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
