// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  DEFAULT_PROJECT_SECTIONS,
  ProjectRights
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { ProjectDrafts } from "../../../src/project/ProjectDrafts.ts";
import { SettingsSections } from "../../../src/shell/settings/SettingsSections.ts";

// CONSTANTS
const kKindPackage = "@jolly-pixel/asset.voxel-map";

function setup() {
  const settings = new SettingsSections({
    user: {
      online: true,
      rights: new ProjectRights({
        share: true,
        export: true,
        readSettings: true,
        editSettings: true,
        audit: true,
        manageAccess: true
      })
    },
    shellScopes: [],
    kindPackages: [
      {
        name: kKindPackage,
        kinds: ["voxelmap"],
        configurable: true
      }
    ]
  });
  const drafts = new ProjectDrafts(() => undefined);
  drafts.rebase({
    revision: "1",
    name: "project",
    editors: [],
    kinds: [
      {
        name: kKindPackage,
        options: {
          size: 8
        },
        sections: []
      }
    ],
    access: {
      defaultRole: "member",
      roles: {
        member: {}
      },
      accessRequests: false
    },
    ...DEFAULT_PROJECT_SECTIONS
  });

  return {
    drafts,
    unsaved: () => [...settings]
      .filter((section) => section.unsaved?.(drafts) ?? false)
      .map((section) => section.id),
    unsavedTabs: () => settings.tabs
      .filter((tab) => tab.unsaved(drafts))
      .map((tab) => tab.id)
  };
}

describe("SettingsSections unsaved marks", () => {
  test("marks General for new account changes and Access for role changes only", () => {
    const { drafts, unsaved } = setup();
    const access = drafts.section("access").current;
    assert.ok(access !== null);

    assert.deepEqual(unsaved(), []);

    drafts.section("access").edit(access.withAccessRequests(true));
    assert.deepEqual(unsaved(), ["project-general"]);

    drafts.section("access").edit(access.addRole("editor"));
    assert.deepEqual(unsaved(), ["project-access"]);
  });

  test("marks the page that holds each other unsaved section", () => {
    const { drafts, unsaved } = setup();
    const kinds = drafts.section("kinds").current;
    assert.ok(kinds !== null);

    drafts.section("game").edit({ start: "arena" });
    drafts.section("kinds").edit(kinds.with(kKindPackage, {
      type: "number",
      label: "Size",
      path: ["size"]
    }, 16));

    assert.deepEqual(unsaved(), [
      "project-general",
      `kind-package:${kKindPackage}`
    ]);
  });

  test("marks the Project tab while one of its pages is unsaved", () => {
    const { drafts, unsavedTabs } = setup();
    const kinds = drafts.section("kinds").current;
    assert.ok(kinds !== null);

    assert.deepEqual(unsavedTabs(), []);

    drafts.section("kinds").edit(kinds.with(kKindPackage, {
      type: "number",
      label: "Size",
      path: ["size"]
    }, 16));

    assert.deepEqual(unsavedTabs(), ["project"]);
  });

  test("marks General for an unsaved snapshot policy", () => {
    const { drafts, unsaved } = setup();

    drafts.section("snapshot").edit({
      delay: 500,
      maxDelay: 30_000
    });

    assert.deepEqual(unsaved(), ["project-general"]);
  });
});
