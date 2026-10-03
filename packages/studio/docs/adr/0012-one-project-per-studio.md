---
status: accepted
---

# One project per studio, seeded without overwriting

A studio process opens exactly one project. The `JOLLY_PROJECT` environment variable picks its
root, resolved against the package and defaulting to `packages/studio/project/`, which is
gitignored.

`createStudioSeed` supplies the seed to both back-ends: the dev server and the offline workspace in
the browser. The seed writes only the paths the root lacks, so pointing the
studio at a real project is safe. Seeded ids are fixed (`map-overworld`, `tileset-overworld`,
`model-default`, `model-texture`) so the README and the tests can name them.

"Workspace" already names four things in this repository. The studio never gives it a fifth
meaning and never exports a type with that word; the studio's word is project.

## Consequences

The studio's handlers come from the project file
([ADR-0016](./0016-the-project-file-lists-editors-and-kinds.md)), and so do those of each
editor's own Vite config and offline workspace.
