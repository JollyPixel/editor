// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AnimationDocument } from "@jolly-pixel/asset.voxel-animation/client";
import { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";
import { MenuSession } from "@jolly-pixel/ui";
import {
  KeyBindingSettings,
  KeyboardLayoutStore,
  ShortcutLabels
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import {
  AnimationLibrary,
  type AnimationSetRecord,
  type AnimationSetSource
} from "#src/features/animation/library/AnimationLibrary.ts";
import { AnimatePanelController } from "#src/features/animation/AnimatePanelController.ts";
import {
  AnimationFocusStore,
  BlockSelectionStore,
  PresenceStore
} from "#src/state/index.ts";
import { AnimationHistories } from "#src/features/animation/undo/AnimationHistories.ts";
import { ClipRemovalFocus } from "#src/features/animation/library/ClipRemovalFocus.ts";
import { createEditorHistory } from "#src/features/history/index.ts";
import type { NameDialogContext } from "#src/shared/dialogs/NameDialog.ts";
import { MODEL_KEY_BINDINGS } from "#src/keybindings/modelActions.ts";
import { createHost } from "./fixtures.ts";
import { modelAccess } from "../../fixtures/modelAccess.ts";

// CONSTANTS
export const MENU_POINT = { x: 0, y: 0 };

export interface FakeSetSource extends AnimationSetSource {
  opened: string[];
  released: string[];
  documents: Map<string, AnimationDocument>;
  notify(): void;
  deny(id: string): void;
}

export function createSetSource(
  records: AnimationSetRecord[] = []
): FakeSetSource {
  const listeners = new Set<() => void>();
  const denials = new Map<string, () => void>();
  const source: FakeSetSource = {
    opened: [],
    released: [],
    documents: new Map(),
    open(id) {
      source.opened.push(id);
      const document = source.documents.get(id) ?? new AnimationDocument();
      source.documents.set(id, document);

      return {
        document,
        room: {
          on: (_type, listener) => denials.set(id, listener),
          off: () => denials.delete(id)
        },
        release: () => source.released.push(id)
      };
    },
    deny(id) {
      denials.get(id)?.();
    },
    create(name) {
      const record = { id: `set-${records.length + 1}`, kind: "voxelanimation", name };
      records.push(record);

      return Promise.resolve({ id: record.id, kind: record.kind });
    },
    createOwn: () => source.create("Robot"),
    rename(id, name) {
      const record = records.find((candidate) => candidate.id === id);
      if (record !== undefined) {
        record.name = name;
      }

      return Promise.resolve();
    },
    records: () => [...records],
    countUsers: (id) => (id === "shared" ? 3 : 1),
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) {
        listener();
      }
    }
  };

  return source;
}

export function createSharedSetSource(): FakeSetSource {
  return createSetSource([{ id: "shared", kind: "voxelanimation", name: "Humanoid" }]);
}

export function createPanelHarness(
  source: AnimationSetSource = createSharedSetSource()
) {
  const document = new ModelDocument();
  const history = createEditorHistory({ document });
  const access = modelAccess();
  const animations = new AnimationLibrary({ document, source, access });
  const animationFocus = new AnimationFocusStore();
  new AnimationHistories({
    history,
    document,
    animations
  });
  const presence = new PresenceStore();
  const clipRemoval = new ClipRemovalFocus({ animations, animationFocus, presence });
  const deletes: string[] = [];
  const prompts: NameDialogContext[] = [];
  const names: string[] = [];
  let menu = MenuSession.EMPTY;
  const controller = new AnimatePanelController(createHost(), {
    promptName: (context) => {
      prompts.push(context);

      return Promise.resolve({ name: names.shift() ?? context.defaultName });
    },
    promptDelete: (context) => {
      deletes.push(context.heading);

      return Promise.resolve({ deleteChildren: false });
    },
    openMenu: (session) => {
      menu = session;
    },
    beginRename: () => undefined
  });
  const keyed: string[] = [];
  const selection = new BlockSelectionStore();
  const keyBindings = new KeyBindingSettings({
    defaults: MODEL_KEY_BINDINGS
  });
  const archiveCalls: string[] = [];
  controller.attach({
    access,
    animations,
    animationFocus,
    archives: {
      canImport: true,
      downloadAsset(assetId) {
        archiveCalls.push(`export ${assetId}`);

        return Promise.resolve();
      },
      pickAndImport(kind) {
        archiveCalls.push(`import ${kind}`);

        return Promise.resolve();
      }
    },
    selection,
    presence,
    clipRemoval,
    keyer: {
      keyBlock: (id) => keyed.push(id) > 0
    },
    shortcuts: new ShortcutLabels(new KeyboardLayoutStore(), keyBindings)
  });

  async function pick(
    label: string
  ): Promise<void> {
    const item = menu.items.find((entry) => entry !== "separator" && entry.label === label);
    assert.ok(item !== undefined && item !== "separator", `no "${label}" in the menu`);
    await menu.run(item.id, MENU_POINT);
  }

  async function rowAction(
    rowLabel: string,
    label: string,
    setId?: string
  ): Promise<void> {
    const { ownClips, sharedSets } = controller.state;
    const rows = [...ownClips, ...sharedSets, ...sharedSets.flatMap(({ children }) => children ?? [])];
    const row = rows.find((candidate) => candidate.label === rowLabel &&
      (setId === undefined || candidate.data?.setId === setId));
    assert.ok(row !== undefined, `no "${rowLabel}" row`);
    menu = controller.rowMenu(row.id);
    await pick(label);
  }

  async function sectionAction(
    section: "own" | "shared",
    label: string
  ): Promise<void> {
    menu = controller.sectionMenu(section);
    await pick(label);
  }

  return {
    access,
    archiveCalls,
    controller,
    animations,
    history,
    animationFocus,
    deletes,
    selection,
    presence,
    keyed,
    keyBindings,
    prompts,
    names,
    pick,
    rowAction,
    sectionAction
  };
}

export function clipLabels(
  nodes: readonly { label: string; }[]
): string[] {
  return nodes.map(({ label }) => label);
}
