// Import Internal Dependencies
import { AuditClient } from "../audit/AuditClient.ts";
import { PreferencesClient } from "../preferences/PreferencesClient.ts";
import { ProjectArchiveClient } from "../project/ProjectArchiveClient.ts";
import { ProjectSettingsClient } from "../project/ProjectSettingsClient.ts";
import { ShareLinksClient } from "../shares/ShareLinksClient.ts";
import { AUDIT_URL_PATH } from "../../shared/api/audit.ts";
import { PREFERENCES_URL_PATH } from "../../shared/api/preferences.ts";
import { PROJECT_URL_PATH } from "../../shared/api/project.ts";
import { SHARES_URL_PATH } from "../../shared/api/shares.ts";

export class StudioClients {
  static at(
    baseUrl: string | URL,
    fetch?: typeof globalThis.fetch
  ): StudioClients {
    function endpoint(path: string) {
      return {
        url: new URL(`.${path}`, baseUrl),
        fetch
      };
    }
    const project = endpoint(PROJECT_URL_PATH);

    return new StudioClients(
      new ShareLinksClient(endpoint(SHARES_URL_PATH)),
      new ProjectArchiveClient(project),
      new ProjectSettingsClient(project),
      new AuditClient(endpoint(AUDIT_URL_PATH)),
      new PreferencesClient(endpoint(PREFERENCES_URL_PATH))
    );
  }

  readonly shares: ShareLinksClient;
  readonly archive: ProjectArchiveClient;
  readonly project: ProjectSettingsClient;
  readonly audit: AuditClient;
  readonly preferences: PreferencesClient;

  private constructor(
    shares: ShareLinksClient,
    archive: ProjectArchiveClient,
    project: ProjectSettingsClient,
    audit: AuditClient,
    preferences: PreferencesClient
  ) {
    this.shares = shares;
    this.archive = archive;
    this.project = project;
    this.audit = audit;
    this.preferences = preferences;
  }
}
