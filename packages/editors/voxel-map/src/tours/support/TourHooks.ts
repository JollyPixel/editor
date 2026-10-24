// Import Third-party Dependencies
import {
  TargetPath,
  type StepEnter,
  type StepUntil,
  type StepWhen,
  type TargetLocator
} from "@jolly-pixel/lantern";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import type { EditorTool } from "../../state/ToolStore.ts";
import { VoxelLayerRef } from "../../state/VoxelLayerRef.ts";
import { TourPage } from "./TourPage.ts";

export type MapWatch = (
  editing: VoxelMapEditing,
  done: () => void,
  tour: TourPage
) => () => void;

// CONSTANTS
const kFindInterval = 100;

export class TourHooks {
  static showPane(
    pane: string
  ): StepEnter {
    return ({ page }) => {
      const layout = page.querySelector("jolly-dock-layout");
      if (layout === null) {
        return;
      }

      const previous = layout.placement(pane)?.group.find(
        (key) => layout.placement(key)?.active === true
      );
      layout.showPane(pane);
      if (previous === undefined || previous === pane) {
        return;
      }

      return () => layout.showPane(previous);
    };
  }

  static texture(
    ...selectors: string[]
  ): TargetLocator {
    const path = new TargetPath(["texture-editor", "pixel-draw-panel", ...selectors]);

    return () => path.resolve(document);
  }

  static textureMode(
    mode: Mode,
    pane = "blocks"
  ): StepEnter {
    const showPane = TourHooks.showPane(pane);

    return async(context) => {
      const restorePane = await showPane(context);
      const tour = new TourPage(context.page);
      await tour.page.querySelector("texture-editor")?.updateComplete;
      await tour.texturePanel?.updateComplete;
      const previous = tour.texturePanel?.canvasManager?.mode;
      TourHooks.#switchMode(tour, mode);

      return () => {
        if (previous !== undefined) {
          TourHooks.#switchMode(tour, previous);
        }
        restorePane?.();
      };
    };
  }

  static openFolder(
    pane: string,
    selectors: readonly string[]
  ): StepEnter {
    const showPane = TourHooks.showPane(pane);
    const path = new TargetPath(selectors);

    return async(context) => {
      const restorePane = await showPane(context);
      const folder = path.resolve(context.page);
      const closed = folder !== null && "open" in folder && folder.open === false;
      if (closed) {
        folder.open = true;
      }

      return () => {
        if (closed) {
          folder.open = false;
        }
        restorePane?.();
      };
    };
  }

  static tool(
    tool: EditorTool
  ): StepEnter {
    return ({ page }) => {
      const state = new TourPage(page).editing?.state.tool;
      if (state === undefined || state.current === tool) {
        return;
      }

      const previous = state.current;
      state.current = tool;

      return () => {
        state.current = previous;
      };
    };
  }

  static build(): StepEnter {
    return ({ page }) => {
      const editing = new TourPage(page).editing;
      if (editing === null) {
        return;
      }

      const { tool, brush, selection } = editing.state;
      const previous = {
        tool: tool.current,
        mode: brush.mode
      };
      tool.current = "brush";
      brush.mode = "build";
      const layer = selection.lastVoxelLayer;
      if (selection.voxelLayer === null && layer !== null) {
        selection.current = new VoxelLayerRef(layer);
      }
      page.querySelector<HTMLCanvasElement>("#game-container > canvas")?.focus();

      return () => {
        tool.current = previous.tool;
        brush.mode = previous.mode;
      };
    };
  }

  static when(
    predicate: (editing: VoxelMapEditing) => boolean
  ): StepWhen {
    return ({ page }) => {
      const editing = new TourPage(page).editing;

      return editing !== null && predicate(editing);
    };
  }

  static finds(
    selectors: readonly string[]
  ): StepWhen {
    return ({ page }) => new TourPage(page).finds(selectors);
  }

  static until(
    watch: MapWatch
  ): StepUntil {
    return ({ page, signal }) => {
      const tour = new TourPage(page);
      const editing = tour.editing;
      if (editing === null) {
        return Promise.reject(new Error("the map editor is not mounted"));
      }

      const { promise, resolve } = Promise.withResolvers<void>();
      const release = watch(editing, resolve, tour);
      signal.addEventListener("abort", release, { once: true });

      return promise.finally(release);
    };
  }

  static untilFinds(
    selectors: readonly string[]
  ): StepUntil {
    return TourHooks.until((_editing, done, tour) => {
      const timer = setInterval(() => {
        if (tour.finds(selectors)) {
          done();
        }
      }, kFindInterval);

      return () => clearInterval(timer);
    });
  }

  static #switchMode(
    tour: TourPage,
    mode: Mode
  ): void {
    const rail = tour.texturePanel?.shadowRoot?.querySelector("mode-rail");
    rail?.dispatchEvent(new CustomEvent<Mode>("mode-change", { detail: mode }));
  }
}
