---
status: accepted
---

# Project packages are trusted code

Listing a package in `.jollypixel/project.json` trusts it, the way adding a Vite plugin does. An
editor from a project's `node_modules` or a local folder runs in a same-origin iframe like the
studio's own editors: it can read the shell's `localStorage` and `sessionStorage`, reach the
shell's document through `window.parent`, and open its own client on the back-end under any
identity. The studio does not sandbox it.

Kind packages already run unsandboxed: their handlers execute in the Node back-end, with the
file system of the machine. Isolating editors alone would leave that open while costing the
editors the features below, so the boundary is the project file, not the frame.

The dev server logs where each editor and kind package was resolved from, project or studio, so
the code a project runs is visible.

## Considered Options

- **A sandboxed iframe without `allow-same-origin`.** The frame gets an opaque `null` origin.
  The `jolly-ready` handshake ([ADR-0003](./0003-the-shell-answers-a-ready-message.md)) checks
  origins, the stored username lives in `sessionStorage`, and the offline workspace needs Web
  Locks, `BroadcastChannel` and IndexedDB on the shell's origin. All of them break.
- **A sandbox with both `allow-scripts` and `allow-same-origin`.** The frame can remove its own
  sandbox; it protects nothing.
- **One origin per external editor.** Another port or host per editor, and back-end URLs that
  are no longer origin-absolute ([ADR-0007](./0007-page-urls-are-relative-to-the-shell.md)).
- **An allowlist of package names.** It repeats the project file, which already is the list.

## Consequences

- Opening a project runs its packages. Review a project's `node_modules` and local folders as
  you would its build scripts.
- Authentication, planned in the [roadmap](../../ROADMAP.md), puts a token in the launch message. Every
  editor receives it, so it grants no more than the editor can already do.
