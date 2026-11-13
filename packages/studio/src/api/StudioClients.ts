// Import Third-party Dependencies
import {
  AUDIT_URL_PATH,
  GOLEM_TOKENS_URL_PATH,
  PREFERENCES_URL_PATH,
  PROJECT_URL_PATH,
  SHARES_URL_PATH
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { AuditClient } from "../audit/AuditClient.ts";
import { AgentTokensClient } from "../golem/AgentTokensClient.ts";
import { PreferencesClient } from "../preferences/PreferencesClient.ts";
import { ProjectArchiveClient } from "../project/ProjectArchiveClient.ts";
import { ProjectSettingsClient } from "../project/ProjectSettingsClient.ts";
import { ShareLinksClient } from "../shares/ShareLinksClient.ts";

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

    return new StudioClients({
      shares: new ShareLinksClient(endpoint(SHARES_URL_PATH)),
      archive: new ProjectArchiveClient(project),
      project: new ProjectSettingsClient(project),
      audit: new AuditClient(endpoint(AUDIT_URL_PATH)),
      preferences: new PreferencesClient(endpoint(PREFERENCES_URL_PATH)),
      agentTokens: new AgentTokensClient(endpoint(GOLEM_TOKENS_URL_PATH))
    });
  }

  readonly shares: ShareLinksClient;
  readonly archive: ProjectArchiveClient;
  readonly project: ProjectSettingsClient;
  readonly audit: AuditClient;
  readonly preferences: PreferencesClient;
  readonly agentTokens: AgentTokensClient;

  private constructor(
    clients: StudioClientSet
  ) {
    this.shares = clients.shares;
    this.archive = clients.archive;
    this.project = clients.project;
    this.audit = clients.audit;
    this.preferences = clients.preferences;
    this.agentTokens = clients.agentTokens;
  }
}

interface StudioClientSet {
  shares: ShareLinksClient;
  archive: ProjectArchiveClient;
  project: ProjectSettingsClient;
  audit: AuditClient;
  preferences: PreferencesClient;
  agentTokens: AgentTokensClient;
}
