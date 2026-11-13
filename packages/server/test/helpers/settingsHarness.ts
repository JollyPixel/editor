// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import { Accounts } from "@jolly-pixel/accounts/node";
import type { SnapshotPolicy } from "@jolly-pixel/asset-server";
import { AssetServer } from "@jolly-pixel/asset-server/node";
import {
  VOXEL_MAP_KIND,
  VoxelMapState
} from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import { AuditLog } from "#src/node/audit/AuditLog.ts";
import { ProjectSettings } from "#src/node/project/ProjectSettings.ts";
import type { StudioProject } from "#src/node/project/StudioProject.ts";
import type {
  ProjectSettingsReply,
  SettingsSectionBody,
  SettingsSectionName,
  SettingsUpdateSections
} from "#src/project/api.ts";
import { openTestProject } from "./testProject.ts";

// CONSTANTS
const kPassword = "p".repeat(43);

export interface SettingsHarness extends AsyncDisposable {
  settings: ProjectSettings;
  project: StudioProject;
  accounts: Accounts;
  audit: AuditLog;
  voxelMapChunkSize(): number;
  revoked: string[];
  snapshotPolicies: SnapshotPolicy[];
  register(username: string): Promise<Account>;
  update<TName extends SettingsSectionName>(
    account: Account,
    section: TName,
    body: SettingsSectionBody<TName>
  ): Promise<ProjectSettingsReply>;
  updateAll(
    account: Account,
    sections: SettingsUpdateSections
  ): Promise<ProjectSettingsReply>;
}

export async function settingsHarness(): Promise<SettingsHarness> {
  const project = await openTestProject();
  const accounts = await Accounts.open({
    roles: project.access.roles
  });
  const assetServer = await AssetServer.open({
    root: project.file.root,
    inMemory: true,
    handlers: project.kinds.handlers(),
    rights: project.access.rights,
    defaultRole: accounts.roles.defaultRole,
    auth: accounts
  });
  const audit = await AuditLog.open(null);
  const revoked: string[] = [];
  const snapshotPolicies: SnapshotPolicy[] = [];
  const settings = new ProjectSettings({
    project,
    accounts,
    server: {
      replaceRights: (rights, defaultRole) => assetServer.network.replaceRights(
        rights,
        defaultRole
      ),
      revoke: (subject) => {
        revoked.push(subject);
        assetServer.network.revoke(subject);
      }
    },
    backend: {
      kinds: assetServer.backend.kinds,
      replaceSnapshotPolicy: (policy) => {
        snapshotPolicies.push(policy);
        assetServer.backend.replaceSnapshotPolicy(policy);
      }
    },
    audit
  });
  function updateAll(
    account: Account,
    sections: SettingsUpdateSections
  ): Promise<ProjectSettingsReply> {
    return settings.replace(account, {
      revision: settings.revision,
      sections
    });
  }

  return {
    project,
    accounts,
    audit,
    revoked,
    snapshotPolicies,
    settings,
    update: (account, section, body) => updateAll(account, {
      [section]: body
    }),
    updateAll,
    voxelMapChunkSize: () => {
      const state = assetServer.backend.kinds.get(VOXEL_MAP_KIND).create("probe");
      assert.ok(state instanceof VoxelMapState);

      return state.world.chunkSize;
    },
    async register(username) {
      const registration = await accounts.register({
        username,
        password: kPassword
      }, {
        address: "203.0.113.7",
        secure: false,
        headers: {}
      });
      assert.ok(registration.status === "active");

      return registration.account;
    },
    async [Symbol.asyncDispose]() {
      await assetServer.close();
      await audit[Symbol.asyncDispose]();
      accounts[Symbol.dispose]();
    }
  };
}
