// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import type { ModelHierarchy } from "#src/model/index.ts";
import {
  PresenceStore,
  TabStore
} from "#src/state/index.ts";
import {
  HierarchyController,
  type HierarchyView
} from "#src/features/hierarchy/HierarchyController.ts";
import type {
  NameDialogContext,
  NameDialogResult
} from "#src/shared/dialogs/NameDialog.ts";
import type {
  HierarchyDuplicateContext,
  HierarchyDuplicateResult
} from "#src/features/hierarchy/dialogs/HierarchyDuplicateDialog.ts";
import type {
  DeleteContext,
  DeleteResult
} from "#src/shared/dialogs/DeleteDialog.ts";
import {
  createModelFixture,
  type ModelFixture
} from "../../fixtures/model.ts";
import { createHierarchy } from "../../fixtures/hierarchy.ts";
import {
  modelAccess,
  type TestModelAccess
} from "../../fixtures/modelAccess.ts";

// CONSTANTS
export const MENU_POINT = {
  x: 0,
  y: 0
};

export interface DialogAnswers {
  name?: NameDialogResult | null;
  duplicate?: HierarchyDuplicateResult | null;
  delete?: DeleteResult | null;
}

export interface DialogCalls {
  name: NameDialogContext[];
  duplicate: HierarchyDuplicateContext[];
  delete: DeleteContext[];
  renamed: string[];
  materialShown: number;
}

export interface HierarchyHarness extends ModelFixture {
  access: TestModelAccess;
  controller: HierarchyController;
  hierarchy: ModelHierarchy;
  calls: DialogCalls;
  tab: TabStore;
  updates(): number;
}

export function createHierarchyHarness(
  answers: DialogAnswers = {}
): HierarchyHarness {
  const fixture = createModelFixture();
  const { document, blocks, selection } = fixture;
  const access = modelAccess();
  const hierarchy = createHierarchy(fixture, access);
  const calls: DialogCalls = {
    name: [],
    duplicate: [],
    delete: [],
    renamed: [],
    materialShown: 0
  };
  const view: HierarchyView = {
    promptName(context) {
      calls.name.push(context);

      return Promise.resolve(answers.name ?? null);
    },
    promptDuplicate(context) {
      calls.duplicate.push(context);

      return Promise.resolve(answers.duplicate ?? null);
    },
    promptDelete(context) {
      calls.delete.push(context);

      return Promise.resolve(answers.delete ?? null);
    },
    beginRename(id) {
      calls.renamed.push(id);
    },
    showMaterial() {
      calls.materialShown++;
    }
  };
  let updates = 0;
  const host: ReactiveControllerHost = {
    addController: (controller) => controller.hostConnected?.(),
    removeController: () => undefined,
    requestUpdate: () => {
      updates++;
    },
    updateComplete: Promise.resolve(true)
  };
  const tab = new TabStore();
  const controller = new HierarchyController(host, view);
  controller.attach({
    access,
    document,
    blocks,
    selection,
    hierarchy,
    presence: new PresenceStore(),
    tab
  });

  return {
    ...fixture,
    access,
    controller,
    hierarchy,
    calls,
    tab,
    updates: () => updates
  };
}

export function selectBlock(
  harness: HierarchyHarness,
  name: string
): string {
  const block = harness.addBlock({ name });
  harness.selection.select(block.uuid);

  return block.uuid;
}

export async function chooseFromMenu(
  harness: HierarchyHarness,
  id: string | null,
  action: string
): Promise<void> {
  await harness.controller.openMenu(id).run(action, MENU_POINT);
}
