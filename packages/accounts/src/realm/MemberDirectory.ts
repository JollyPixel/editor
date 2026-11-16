// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { AccountActivity } from "../AccountActivity.ts";
import type {
  AccountDirectory,
  Credentials
} from "../AccountDirectory.ts";
import {
  ADMIN_ROLE,
  type AccessRequest,
  type Account,
  type Member
} from "../account/Account.ts";
import type { AccountEntity } from "../account/AccountEntity.ts";
import type { Username } from "../account/Username.ts";
import { AccountChangeRefusedError } from "../account/errors/AccountChangeRefusedError.ts";
import { agentTokenSubject } from "../agent/AgentToken.ts";
import type { AccountRoles } from "../auth/AccountRoles.ts";
import { AccessRequestsFullError } from "../registration/errors/AccessRequestsFullError.ts";
import { AccountPendingError } from "../registration/errors/AccountPendingError.ts";
import type { RegisterOptions } from "../registration/RegisterOptions.ts";
import type { RegistrationResult } from "../registration/RegistrationResult.ts";
import { shareLinkSubject } from "../share/ShareLinks.ts";
import type { AccountsDatabase } from "../store/AccountsDatabase.ts";
import type { JoinMode } from "./JoinMode.ts";
import { Membership } from "./Membership.ts";
import { InvitationRequiredError } from "./errors/InvitationRequiredError.ts";
import { MembershipRequiredError } from "./errors/MembershipRequiredError.ts";

// CONSTANTS
const kDefaultMaxRequests = 20;

export interface Registration extends Credentials {
  options: RegisterOptions;
}

export interface MemberDirectoryOptions {
  realmId: string;
  accounts: AccountDirectory;
  roles: AccountRoles;
  join?: JoinMode;
  maxRequests?: number;
}

export type MemberDirectoryEventMap = {
  changed: () => void;
  revoked: (subject: string) => void;
  disconnected: (subject: string) => void;
  profile: (member: Member) => void;
  activity: (activity: AccountActivity) => void;
};

interface ExistingMember {
  account: AccountEntity;
  membership: Membership;
}

export class MemberDirectory extends Emitter<MemberDirectoryEventMap>
  implements Iterable<Member>, Disposable {
  readonly realmId: string;

  #accounts: AccountDirectory;
  #database: AccountsDatabase;
  #roles: AccountRoles;
  #join: JoinMode;
  #maxRequests: number;
  #unsubscribe: (() => void)[];

  constructor(
    options: MemberDirectoryOptions
  ) {
    super();

    options.accounts.openRealm(options.realmId);
    this.realmId = options.realmId;
    this.#accounts = options.accounts;
    this.#database = options.accounts.database;
    this.#roles = options.roles;
    this.#join = options.join ?? "request";
    this.#maxRequests = options.maxRequests ?? kDefaultMaxRequests;
    this.#unsubscribe = [
      this.#accounts.subscribe("changed", () => this.emit("changed")),
      this.#accounts.subscribe(
        "revoked",
        (subject) => this.emit("revoked", subject)
      ),
      this.#accounts.subscribe("profile", (account) => {
        const member = this.member(account.id);
        if (member !== null) {
          this.emit("profile", member);
        }
      })
    ];
  }

  get roles(): AccountRoles {
    return this.#roles;
  }

  get join(): JoinMode {
    return this.#join;
  }

  replaceRoles(
    roles: AccountRoles,
    renamed: ReadonlyMap<string, string> = new Map()
  ): void {
    for (const [from, to] of renamed) {
      if (roles.has(from) || !roles.has(to)) {
        throw new AccountChangeRefusedError(
          `the "${from}" role cannot be renamed to "${to}"`
        );
      }
    }
    const moved = this.#database.transaction(() => {
      const memberships = this.#database.memberships
        .inRealm(this.realmId)
        .flatMap((membership) => {
          const role = renamed.get(membership.role);

          return role === undefined ? [] : [membership.withRole(role)];
        });
      for (const membership of memberships) {
        this.#database.memberships.save(membership);
      }

      return memberships;
    });
    this.#roles = roles;
    this.emit("changed");
    for (const membership of moved) {
      this.#revokeAccount(membership.accountId);
    }
  }

  replaceJoin(
    join: JoinMode
  ): void {
    this.#join = join;
  }

  async register(
    registration: Registration,
    address: string
  ): Promise<RegistrationResult> {
    const { username, password, options } = registration;

    await this.#accounts.admitRegistration(options.masterPassword, address);
    if (this.#accounts.claimed) {
      this.#assertJoinable();
    }
    const hash = await this.#accounts.hash(password);
    const { account, membership } = this.#database.transaction(() => {
      const inserted = this.#accounts.insert(username, hash);

      return {
        account: inserted,
        membership: inserted.owner ? null : this.#enroll(inserted.id)
      };
    });
    const pending = membership?.pending === true;
    this.emit("changed");
    this.record({
      type: "registered",
      actorId: account.id,
      accountId: account.id,
      username: account.username,
      pending
    });

    return pending ?
      { status: "pending" } :
      {
        status: "active",
        account: this.#toMember(account, membership)
      };
  }

  async login(
    credentials: Credentials,
    address: string
  ): Promise<Member> {
    return this.admit(
      await this.#accounts.login(credentials, address)
    );
  }

  admit(
    account: AccountEntity
  ): Member {
    if (account.owner) {
      return this.#toMember(account, null);
    }
    const membership = this.#database.memberships.find(
      this.realmId,
      account.id
    );
    if (membership === null) {
      throw new MembershipRequiredError();
    }
    if (membership.pending) {
      throw new AccountPendingError();
    }

    return this.#toMember(account, membership);
  }

  member(
    accountId: string
  ): Member | null {
    const account = this.#database.accounts.byId(accountId);
    if (account === null) {
      return null;
    }
    const membership = this.#database.memberships.find(
      this.realmId,
      accountId
    );
    if (!account.owner && (membership === null || membership.pending)) {
      return null;
    }

    return this.#toMember(account, membership);
  }

  isAdmin(
    accountId: string
  ): boolean {
    return this.member(accountId)?.role === ADMIN_ROLE;
  }

  holders(
    role: string
  ): string[] {
    return this.#database.memberships
      .inRealm(this.realmId)
      .filter((membership) => membership.role === role)
      .map((membership) => membership.accountId);
  }

  assignRole(
    actorId: string,
    username: Username,
    role: string
  ): Member {
    const { account, membership, from } = this.#database.transaction(() => {
      this.#assertAdmin(actorId);
      this.#assertDeclared(role);
      const target = this.#existingMember(username);
      const changed = target.membership.withRole(role);
      this.#database.memberships.save(changed);

      return {
        account: target.account,
        membership: changed,
        from: target.membership.role
      };
    });
    this.#changed({
      type: "role-changed",
      actorId,
      accountId: account.id,
      username: account.username,
      from,
      to: role
    });
    this.#revokeAccount(account.id);

    return this.#toMember(account, membership);
  }

  approve(
    actorId: string,
    username: Username,
    role: string
  ): Member {
    const { account, membership } = this.#database.transaction(() => {
      this.#assertAdmin(actorId);
      this.#assertDeclared(role);
      const request = this.#existingRequest(username);
      const approved = request.membership.approved(role);
      this.#database.memberships.save(approved);

      return {
        account: request.account,
        membership: approved
      };
    });
    this.#changed({
      type: "approved",
      actorId,
      accountId: account.id,
      username: account.username,
      role
    });

    return this.#toMember(account, membership);
  }

  deny(
    actorId: string,
    username: Username
  ): void {
    const { account } = this.#database.transaction(() => {
      this.#assertAdmin(actorId);
      const request = this.#existingRequest(username);
      this.#database.memberships.delete(this.realmId, request.account.id);

      return request;
    });
    this.#changed({
      type: "denied",
      actorId,
      accountId: account.id,
      username: account.username
    });
  }

  remove(
    actorId: string,
    username: Username
  ): Account {
    const { account, subjects } = this.#database.transaction(() => {
      this.#assertAdmin(actorId);
      const target = this.#existingMember(username).account;
      this.#database.memberships.delete(this.realmId, target.id);
      const links = this.#database.shareLinks.deleteCreatedBy(
        this.realmId,
        target.id
      );
      const tokens = this.#database.agentTokens.revokeOwnedBy(
        this.realmId,
        target.id,
        Date.now()
      );

      return {
        account: target,
        subjects: [
          target.id,
          ...links.map((link) => shareLinkSubject(link.id)),
          ...tokens.map((token) => agentTokenSubject(token.id))
        ]
      };
    });
    this.#changed({
      type: "removed",
      actorId,
      accountId: account.id,
      username: account.username
    });
    for (const subject of subjects) {
      this.revoke(subject);
    }

    return this.#accounts.toAccount(account);
  }

  transferOwnership(
    actorId: string,
    username: Username
  ): Account {
    if (this.#database.accounts.byId(actorId)?.owner === true) {
      this.#existingMember(username);
    }
    const owner = this.#accounts.transferOwnership(actorId, username);
    this.record({
      type: "owner-transferred",
      actorId,
      accountId: owner.id,
      username: owner.username
    });

    return this.#accounts.toAccount(owner);
  }

  revoke(
    subject: string
  ): void {
    this.emit("revoked", subject);
  }

  disconnect(
    subject: string
  ): void {
    this.emit("disconnected", subject);
  }

  record(
    activity: AccountActivity
  ): void {
    this.emit("activity", activity);
  }

  * [Symbol.iterator](): IterableIterator<Member> {
    const memberships = new Map(
      this.#database.memberships
        .inRealm(this.realmId)
        .map((membership) => [membership.accountId, membership])
    );
    for (const account of this.#database.accounts) {
      const membership = memberships.get(account.id) ?? null;
      if (account.owner || membership?.pending === false) {
        yield this.#toMember(account, membership);
      }
    }
  }

  * requests(): IterableIterator<AccessRequest> {
    for (const membership of this.#database.memberships.inRealm(this.realmId)) {
      const account = membership.pending ?
        this.#database.accounts.byId(membership.accountId) :
        null;
      if (account !== null) {
        yield {
          id: account.id,
          username: account.username
        };
      }
    }
  }

  [Symbol.dispose](): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
    this.#accounts.closeRealm(this.realmId);
  }

  #enroll(
    accountId: string
  ): Membership {
    this.#assertJoinable();
    const membership = this.#join === "open" ?
      Membership.active(this.realmId, accountId, this.#roles.defaultRole) :
      Membership.request(this.realmId, accountId, this.#roles.defaultRole);
    this.#database.memberships.save(membership);

    return membership;
  }

  #assertJoinable(): void {
    if (this.#join === "invite") {
      throw new InvitationRequiredError();
    }
    if (
      this.#join === "request" &&
      this.#database.memberships.pendingSize(this.realmId) >= this.#maxRequests
    ) {
      throw new AccessRequestsFullError(this.#maxRequests);
    }
  }

  #revokeAccount(
    accountId: string
  ): void {
    this.revoke(accountId);
    for (const token of this.#database.agentTokens.ownedBy(this.realmId, accountId)) {
      this.revoke(agentTokenSubject(token.id));
    }
  }

  #changed(
    activity: AccountActivity
  ): void {
    this.emit("changed");
    this.record(activity);
  }

  #assertAdmin(
    actorId: string
  ): void {
    if (!this.isAdmin(actorId)) {
      throw new AccountChangeRefusedError("only an admin manages accounts");
    }
  }

  #assertDeclared(
    role: string
  ): void {
    if (!this.#roles.has(role)) {
      throw new AccountChangeRefusedError(`"${role}" is not a role`);
    }
  }

  #existingMember(
    username: Username
  ): ExistingMember {
    const account = this.#database.accounts.named(username);
    account?.assertNotOwner();
    const membership = account === null ?
      null :
      this.#database.memberships.find(this.realmId, account.id);
    if (account === null || membership === null || membership.pending) {
      throw new AccountChangeRefusedError(
        `no member is named "${username.value}"`
      );
    }

    return {
      account,
      membership
    };
  }

  #existingRequest(
    username: Username
  ): ExistingMember {
    const account = this.#database.accounts.named(username);
    const membership = account === null ?
      null :
      this.#database.memberships.find(this.realmId, account.id);
    if (account === null || membership === null || !membership.pending) {
      throw new AccountChangeRefusedError(
        `no access request is named "${username.value}"`
      );
    }

    return {
      account,
      membership
    };
  }

  #toMember(
    account: AccountEntity,
    membership: Membership | null
  ): Member {
    return {
      ...this.#accounts.toAccount(account),
      role: account.owner || membership === null ?
        ADMIN_ROLE :
        this.#roles.effective(membership.role)
    };
  }
}
