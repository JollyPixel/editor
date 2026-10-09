// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { MaterialSurface } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  MaterialLibraryController,
  type MaterialLibraryPrompts
} from "#src/features/material/library/MaterialLibraryController.ts";
import { MaterialSurfaceController } from "#src/features/material/surface/MaterialSurfaceController.ts";
import {
  MATERIAL_PRESETS,
  type MaterialPreset
} from "#src/features/material/library/materialPresets.ts";
import {
  MaterialFocusStore,
  PresenceStore,
  ViewSettingsStore
} from "#src/state/index.ts";
import type {
  DeleteContext,
  DeleteResult
} from "#src/shared/dialogs/DeleteDialog.ts";
import type { MenuPoint } from "#src/shared/menu/MenuSession.ts";
import { createEditorHistory } from "#src/features/history/index.ts";
import { createModelFixture } from "../../fixtures/model.ts";

// CONSTANTS
export const GLASS_SURFACE = MaterialSurface.create({ opacity: 0.4 });
export const METAL_SURFACE = MaterialSurface.create({ metalness: 0.8 });

export interface MaterialHarnessOptions {
  deleteAnswer?: DeleteResult | null;
  clipboard?: string | null;
}

export function createMaterialHarness(
  options: MaterialHarnessOptions = {}
) {
  const fixture = createModelFixture();
  const materialFocus = new MaterialFocusStore();
  const presence = new PresenceStore();
  const host: ReactiveControllerHost = {
    addController: (controller) => controller.hostConnected?.(),
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true)
  };
  const calls = {
    deletes: [] as DeleteContext[],
    renamed: [] as string[],
    written: [] as string[],
    presetPoints: [] as MenuPoint[]
  };
  const prompts: MaterialLibraryPrompts = {
    promptDelete(context) {
      calls.deletes.push(context);

      return Promise.resolve(options.deleteAnswer ?? null);
    },
    beginRename(id) {
      calls.renamed.push(id);
    },
    choosePreset(choose, point) {
      calls.presetPoints.push(point);
      choose(preset("metal"));
    },
    writeClipboard(text) {
      calls.written.push(text);

      return Promise.resolve();
    },
    readClipboard() {
      return Promise.resolve(options.clipboard ?? null);
    }
  };
  const controller = new MaterialLibraryController(host, prompts);
  const surface = new MaterialSurfaceController(host);
  const view = new ViewSettingsStore();
  const workspace = {
    ...fixture,
    history: createEditorHistory({ document: fixture.document }),
    materialFocus,
    presence,
    view
  };
  controller.attach(workspace);
  surface.attach(workspace);

  const actions: string[] = [];
  fixture.document.on("change", (change) => actions.push(change.command.action));
  const glass = fixture.document.addMaterial({ name: "Glass", surface: GLASS_SURFACE })!;
  actions.length = 0;

  return {
    ...fixture,
    materialFocus,
    presence,
    view,
    controller,
    surface,
    calls,
    actions,
    glass
  };
}

export type MaterialHarness = ReturnType<typeof createMaterialHarness>;

export function preset(
  id: string
): MaterialPreset {
  const found = MATERIAL_PRESETS.find((item) => item.id === id);
  assert.ok(found);

  return found;
}
