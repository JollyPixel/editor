// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AccessDraft } from "../../../src/project/AccessDraft.ts";
import { StudioProjectSettings } from "../../../src/project/StudioProjectSettings.ts";
import type {
  AccessChange,
  ProjectSettingsReply
} from "../../../shared/api/project.ts";
import { KindFilter } from "../../../shared/KindFilter.ts";
import { ProjectRights } from "../../../shared/ProjectRights.ts";
import { SettingsDraftController } from "../../../src/shell/settings/project/SettingsDraftController.ts";

// CONSTANTS
const kHost = {
  addController: () => undefined,
  removeController: () => undefined,
  requestUpdate: () => undefined,
  updateComplete: Promise.resolve(true)
};

async function accessDraft(): Promise<SettingsDraftController<AccessDraft>> {
  let reply: ProjectSettingsReply = {
    name: "project",
    editors: [],
    kinds: [],
    kindFilter: {
      hidden: []
    },
    access: {
      defaultRole: "spectator",
      roles: {
        spectator: {
          "*": "read"
        }
      },
      accessRequests: false
    }
  };
  const project = new StudioProjectSettings({
    read: async() => reply,
    replaceKinds: async() => reply,
    replaceKindFilter: async() => reply,
    replaceAccess: async({ access }: AccessChange) => {
      reply = {
        ...reply,
        access
      };

      return reply;
    }
  }, new ProjectRights({
    share: true,
    export: true,
    readSettings: true,
    editSettings: true,
    audit: true,
    manageAccess: true
  }), KindFilter.NONE);
  await project.load();
  const controller = new SettingsDraftController(kHost, {
    saved: (data) => (data.access === undefined ? null : AccessDraft.from(data.access)),
    save: (settings, draft) => settings.replaceAccess(draft.toChange())
  });
  controller.attach(project);

  return controller;
}

describe("SettingsDraftController", () => {
  test("counts an edit as a change only when it differs from the saved section", async() => {
    const draft = await accessDraft();
    const saved = draft.draft;
    assert.ok(saved !== null);

    draft.edit(saved.withAccessRequests(false));
    assert.deepEqual([draft.edited, draft.changed], [true, false]);

    draft.edit(saved.withAccessRequests(true));
    assert.equal(draft.changed, true);
  });

  test("drops the edit once saved, so the saved section shows", async() => {
    const draft = await accessDraft();
    const saved = draft.draft;
    assert.ok(saved !== null);
    draft.edit(saved.withAccessRequests(true));

    await draft.save();

    assert.equal(draft.edited, false);
    assert.equal(draft.draft?.accessRequests, true);
  });
});
