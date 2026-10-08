// Import Third-party Dependencies
import {
  AccountsClient,
  AccountsRoster,
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
import {
  peerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { StudioSignedIn } from "./accounts/StudioSignedIn.ts";
import "./shell/account/SignInDialog.ts";

export interface StudioConnection {
  share: CatalogShare;
  editorQuery: Readonly<Record<string, string>>;
  identity: PeerIdentity | null;
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
  const account = await accounts.me() ?? await signIn(accounts);
  const identity = peerIdentity(account.username, account.id);
  const client = new Client({
    profile: toPeerMetadata(identity)
  });
  const signedIn: StudioSignedIn = {
    account,
    roster: AccountsRoster.join(client),
    signOut: () => signOut(accounts)
  };
  client.on("unauthorized", () => {
    void signedIn.signOut();
  });

  return {
    share: await CatalogShare.open(client, {
      timeoutMs: CATALOG_TIMEOUT_MS
    }),
    editorQuery: {},
    identity,
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

async function signOut(
  accounts: AccountsClient
): Promise<void> {
  try {
    await accounts.logout();
  }
  finally {
    location.reload();
  }
}
