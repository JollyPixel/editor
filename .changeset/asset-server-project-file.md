---
"@jolly-pixel/asset-server": minor
---

Add `ProjectFile`, `ProjectKinds` and `KindPackage` to load the kind packages a project lists in `.jollypixel/project.json`, checking their options against each package's `optionsSchema`.
Add the `AssetKindPackage` type kind packages export as `ASSET_KINDS`, and `SNAPSHOT_POLICY_SCHEMA`.
Add `PackageResolver` to resolve kind packages from the project root, fallbacks or local folders, `createProjectKindsPlugin` serving their handlers to browser code, and `createProjectFileWatchPlugin` restarting the dev server when the project file changes.
