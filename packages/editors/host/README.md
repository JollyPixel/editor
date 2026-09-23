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
  type EditorContext
} from "@jolly-pixel/editor.host";
import {
  pixelArtDocumentKind
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

class MyEditor {
  static readonly accepts = "voxelmap";
  static readonly identity = { title: "Join voxel map" };
  static readonly kinds = [
    pixelArtDocumentKind()
  ];

  static async mount(
    context: EditorContext
  ): Promise<MyEditor> {
    const editorRuntime = await EditorRuntime.create("#canvas");
    await editorRuntime.load(
      new MyScene(context.session.target.room)
    );

    return new MyEditor(context);
  }

  // ...

  dispose(): void {
    this.session.dispose();
  }
}

await mountStandalone(MyEditor, {
  dev: import.meta.env.DEV
});
```

## 📚 API

### Boot

- [`mountStandalone`](./docs/mountStandalone.md): the editor definition, launch
  sources, the shell channel and the debug handle.
- [`QueryParams`](./docs/QueryParams.md): typed query-string parameters.

### Session

- [`EditorSession`](./docs/EditorSession.md): the target room, live
  dependencies and their events.
- [`AssetLeases`](./docs/AssetLeases.md): shared rooms and synced documents per
  asset.

### Scene

- [`EditorRuntime`](./docs/EditorRuntime.md): runtime boot with the editor
  keyboard rules.
- [`PeerFrustums`](./docs/PeerFrustums.md): peer camera frustums as an actor
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
