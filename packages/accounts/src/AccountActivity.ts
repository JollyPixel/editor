export type AccountActivity =
  | {
    type: "registered";
    actorId: string;
    accountId: string;
    username: string;
    pending: boolean;
  }
  | {
    type: "approved";
    actorId: string;
    accountId: string;
    username: string;
    role: string;
  }
  | {
    type: "denied" | "owner-transferred" | "removed";
    actorId: string;
    accountId: string;
    username: string;
  }
  | {
    type: "role-changed";
    actorId: string;
    accountId: string;
    username: string;
    from: string;
    to: string;
  }
  | {
    type: "share-link-created" | "share-link-revoked";
    actorId: string;
    linkId: string;
    assetId: string;
  };
