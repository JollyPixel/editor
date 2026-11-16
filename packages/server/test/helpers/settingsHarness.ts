// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Member } from "@jolly-pixel/accounts";
import {
  Accounts,
  type AccountsRealm
} from "@jolly-pixel/accounts/node";
import type { SnapshotPolicy } from "@jolly-pixel/asset-server";
import { AssetServer } from "@jolly-pixel/asset-server/node";
import {
  VOXEL_MAP_KIND,
  VoxelMapState
} from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import { AuditLog } from "#src/audit/node/AuditLog.ts";
import { ProjectSettings } from "#src/project/node/ProjectSettings.ts";
import type { StudioProject } from "#src/project/node/StudioProject.ts";
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
  realm: AccountsRealm;
  audit: AuditLog;
  voxelMapChunkSize(): number;
  revoked: string[];
  snapshotPolicies: SnapshotPolicy[];
  register(username: string): Promise<Member>;
  update<TName extends SettingsSectionName>(
    account: Member,
    section: TName,
    body: SettingsSectionBody<TName>
  ): Promise<ProjectSettingsReply>;
  updateAll(
    account: Member,
    sections: SettingsUpdateSections
  ): Promise<ProjectSettingsReply>;
}

export async function settingsHarness(): Promise<SettingsHarness> {
  const project = await openTestProject();
  const accounts = await Accounts.open({});
  const realm = accounts.realm("project", {
    roles: project.access.roles,
    join: "open"
  });
  const assetServer = await AssetServer.open({
    root: project.file.root,
    inMemory: true,
    handlers: project.kinds.handlers(),
    rights: project.access.rights,
    defaultRole: realm.roles.defaultRole,
    auth: realm
  });
  const audit = await AuditLog.open(null);
  const revoked: string[] = [];
  const snapshotPolicies: SnapshotPolicy[] = [];
  const settings = new ProjectSettings({
    project,
    realm,
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
    account: Member,
    sections: SettingsUpdateSections
  ): Promise<ProjectSettingsReply> {
    return settings.replace(account, {
      revision: settings.revision,
      sections
    });
  }

  return {
    project,
    realm,
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
      const registration = await realm.register({
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
