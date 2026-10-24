# Architecture

`@jolly-pixel/studio` opens one project: one asset back-end, one asset tree,
one editor page per tab. Terms are defined in the [glossary](./GLOSSARY.md),
decisions in the [ADRs](./docs/adr/README.md).

## One project, one back-end

```mermaid
flowchart TB
    File[".jollypixel/project.json"] --> Project["StudioProject"]
    Project --> Kinds["kind packages"]
    Project --> Editors["editor packages"]
    Kinds --> Backend["StudioBackend<br/>asset server, accounts, /api/"]
    Editors --> Manifest["project manifest + editor pages"]
```

- The project file lists the editors and kinds. Only the server writes it.
- `vite/backend` mounts the back-end in dev, `StudioServer` when hosted. The static build has none and starts offline.
- Code: `server/`, `vite/`.

## Data in the shell, code in the frames

```mermaid
flowchart TB
    Backend["back-end"] -->|"catalog + manifest"| Shell["shell<br/>asset tree + tabs"]
    Shell <-->|"postMessage"| Frame["editor frame<br/>one per tab"]
    Frame <-->|"asset rooms"| Backend
```

- The shell never loads kind handler or editor code, and shares no objects with the frames.
- `shared/` holds what the browser and the server both need. `server/` never imports `src/`.
- Code: `src/shell/`, `shared/`.

## Opening an asset

```mermaid
flowchart TB
    Browser["asset-browser"] -->|"asset-open"| Session["StudioSession"]
    Session --> Tabs["EditorTabs"]
    Tabs --> Frames["EditorFrames"]
    Frames -->|"jolly-ready, jolly-launch"| Frame["editor frame"]
    Frame -->|"jolly-shell commands"| Session
```

- The iframe is created on first focus, then only hidden: moving it would reload it.
- The launch carries ports for the shell catalog and the frame's console.
- Code: `src/tabs/`, `src/shell/`.

## Who may do what

```mermaid
flowchart TB
    Cookie["session cookie"] --> Accounts["Accounts<br/>role per account"]
    AccessFile["access section"] --> Access["StudioAccess<br/>rights table"]
    Accounts --> Access
    Share["share link guest"] --> Rooms["asset rooms"]
    Access --> Rooms
    Access --> Api["/api/ routes<br/>ProjectRights"]
```

- Assets reach the browser through the rooms only. Vite never serves the asset files.
- Offline there are no accounts, and every project right is false.
- Code: `server/accounts.ts`, `server/project/`, `server/shares/`, `src/accounts/`. See [accounts](./docs/accounts.md).

## Preferences follow the account

```mermaid
flowchart TB
    Store["accounts.db<br/>or localStorage offline"] --> Prefs["shell Preferences"]
    Prefs -->|"jolly-preferences"| Frames["frames that read the scope"]
    Frames -->|"update-preferences"| Prefs
```

- The scopes come from the shell, the host and each editor package. The server drops unknown scopes and fields.
- Code: `shared/PreferenceScopes.ts`, `server/preferences/`, `src/preferences/`.

## Editor pages

```mermaid
flowchart TB
    Package["editor package<br/>jollypixel.editor manifest"] --> Dev["dev: its own page folder"]
    Package --> Build["build:hosted, build:static<br/>compiled with the shell"]
    Build --> Chunks["one ui, lit and three across pages"]
```

- In dev, a rebuilt page folder reloads that editor's tabs.
- `test/vite/studio.bundle.spec.ts` guards the shared chunks.
- Code: `server/editors/`, `vite/editorPages.ts`. See [hosting](./docs/hosting.md).
