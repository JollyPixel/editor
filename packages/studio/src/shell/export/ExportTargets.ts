// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { JollyOption } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ExportTarget } from "./ExportTarget.ts";
import { ProjectSourcesExport } from "./ProjectSourcesExport.ts";
import { WebGameExport } from "./WebGameExport.ts";

// CONSTANTS
const kStudioTiles: JollyOption<string>[] = [
  {
    value: "web",
    label: "Web",
    icon: "web",
    caption: "HTML5 game"
  },
  {
    value: "desktop",
    label: "Desktop",
    icon: "desktop",
    caption: "Coming soon",
    disabled: true
  },
  {
    value: "android",
    label: "Android",
    icon: "mobile",
    caption: "Coming soon",
    disabled: true
  },
  {
    value: "project",
    label: "Project",
    icon: "archive",
    caption: "Sources"
  }
];

export class ExportTargets {
  static readonly STUDIO = new ExportTargets(
    kStudioTiles,
    [
      new WebGameExport(),
      new ProjectSourcesExport()
    ]
  );

  #tiles: readonly JollyOption<string>[];
  #targets: readonly ExportTarget[];

  constructor(
    tiles: Iterable<JollyOption<string>>,
    targets: Iterable<ExportTarget>
  ) {
    this.#tiles = [...tiles];
    this.#targets = [...targets];
  }

  options(): JollyOption<string>[] {
    return [...this.#tiles];
  }

  find(
    name: string
  ): ExportTarget | undefined {
    return this.#targets.find((target) => target.name === name);
  }

  initial(
    remembered: string,
    defaultScene: AssetRecordData | null
  ): ExportTarget {
    const ready = this.#targets.filter(
      (target) => target.blocker(defaultScene) === null
    );

    return ready.find((target) => target.name === remembered) ??
      ready[0] ??
      this.#targets[0];
  }
}
