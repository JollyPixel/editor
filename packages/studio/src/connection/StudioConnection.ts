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
import { StudioSignedIn } from "../accounts/StudioSignedIn.ts";
import type { StudioUser } from "../accounts/StudioUser.ts";
import { StudioClients } from "../api/StudioClients.ts";
import "../shell/account/SignInDialog.ts";

export interface StudioConnection {
  share: CatalogShare;
  editorQuery: Readonly<Record<string, string>>;
  user: StudioUser;
}

export function connectStudio(): Promise<StudioConnection> {
  if (
    import.meta.env.MODE === "static" ||
      HOST_PARAMS.read().offline !== undefined
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
  const user = await StudioSignedIn.open({
    accounts,
    signIn: () => signIn(accounts),
    api: StudioClients.at(document.baseURI),
    connect: (profile) => new Client({ profile }),
    reload: () => location.reload()
  });

  return {
    share: await CatalogShare.open(user.client, {
      timeoutMs: CATALOG_TIMEOUT_MS
    }),
    editorQuery: {},
    user
  };
}

async function connectOffline(): Promise<StudioConnection> {
  const offline = await import("./offline.ts");

  return offline.connect();
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
