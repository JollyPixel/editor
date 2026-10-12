// Import Third-party Dependencies
import {
  AccountsClient,
  ACCOUNTS_URL_PATH,
  type Account
} from "@jolly-pixel/accounts";
import {
  CATALOG_TIMEOUT_MS,
  CatalogShare,
  HOST_PARAMS,
  withOfflineFallback
} from "@jolly-pixel/editor.host";
import { Client } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { StudioSignedIn } from "./accounts/StudioSignedIn.ts";
import { ProjectArchiveClient } from "./project/ProjectArchiveClient.ts";
import { PROJECT_URL_PATH } from "./project/routes.ts";
import { ShareLinksClient } from "./shares/ShareLinksClient.ts";
import { SHARES_URL_PATH } from "./shares/routes.ts";
import "./shell/account/SignInDialog.ts";

export interface StudioConnection {
  share: CatalogShare;
  editorQuery: Readonly<Record<string, string>>;
  signedIn: StudioSignedIn | null;
}

export function connectStudio(): Promise<StudioConnection> {
  if (
    import.meta.env.MODE === "static" || HOST_PARAMS.read().offline
  ) {
    return connectOffline();
  }

  return withOfflineFallback({
    message: "The asset catalog is unreachable.",
    online: connectOnline,
    offline: connectOffline
  });
}

async function connectOnline(): Promise<StudioConnection> {
  const accounts = new AccountsClient({
    url: new URL(`.${ACCOUNTS_URL_PATH}`, document.baseURI)
  });
  const signedIn = await StudioSignedIn.open({
    accounts,
    signIn: () => signIn(accounts),
    shareLinks: new ShareLinksClient({
      url: new URL(`.${SHARES_URL_PATH}`, document.baseURI)
    }),
    projectArchive: new ProjectArchiveClient({
      url: new URL(`.${PROJECT_URL_PATH}`, document.baseURI)
    }),
    connect: (profile) => new Client({ profile }),
    reload: () => location.reload()
  });

  return {
    share: await CatalogShare.open(signedIn.client, {
      timeoutMs: CATALOG_TIMEOUT_MS
    }),
    editorQuery: {},
    signedIn
  };
}

async function connectOffline(): Promise<StudioConnection> {
  const offline = await import("./offlineConnection.ts");

  return offline.connectOffline();
}

async function signIn(
  accounts: AccountsClient
): Promise<Account> {
  const dialog = document.createElement("studio-sign-in");
  (document.querySelector("jolly-scope") ?? document.body).append(dialog);
  try {
    return await dialog.open(accounts);
  }
  finally {
    dialog.remove();
  }
}
