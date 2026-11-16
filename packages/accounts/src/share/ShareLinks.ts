// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Internal Dependencies
import type { MemberDirectory } from "../realm/MemberDirectory.ts";
import { SessionToken } from "../session/SessionToken.ts";
import type { ShareLinkRepository } from "../store/ShareLinkRepository.ts";
import type { ShareLink } from "./ShareLink.ts";
import { ShareLinkNotFoundError } from "./errors/ShareLinkNotFoundError.ts";
import { ShareLinkRefusedError } from "./errors/ShareLinkRefusedError.ts";

// CONSTANTS
const kSubjectPrefix = "share:";
const kMaxTimerDelayMs = 2 ** 31 - 1;

export interface ShareLinkCreation {
  assetId: string;
  createdBy: string;
  /**
   * Epoch milliseconds, or `null` for a link that never expires.
   */
  expiresAt: number | null;
}

export function shareLinkSubject(
  linkId: string
): string {
  return kSubjectPrefix + linkId;
}

export class ShareLinks implements Disposable {
  #repository: ShareLinkRepository;
  #members: MemberDirectory;
  #expiry: ReturnType<typeof setTimeout> | null = null;

  constructor(
    repository: ShareLinkRepository,
    members: MemberDirectory
  ) {
    this.#repository = repository;
    this.#members = members;
    this.#scheduleExpiry();
  }

  create(
    creation: ShareLinkCreation
  ): ShareLink {
    const now = Date.now();
    if (creation.expiresAt !== null && creation.expiresAt <= now) {
      throw new RangeError("a share link must expire in the future");
    }
    if (this.#members.member(creation.createdBy) === null) {
      throw new ShareLinkRefusedError("the creator is not a member");
    }

    const link: ShareLink = {
      id: randomUUID(),
      token: SessionToken.mint().value,
      assetId: creation.assetId,
      createdBy: creation.createdBy,
      createdAt: now,
      expiresAt: creation.expiresAt
    };
    this.#repository.insert(this.#members.realmId, link);
    this.#scheduleExpiry();
    this.#members.record({
      type: "share-link-created",
      actorId: link.createdBy,
      linkId: link.id,
      assetId: link.assetId
    });

    return link;
  }

  find(
    token: string
  ): ShareLink | null {
    return SessionToken.parse(token) === null ?
      null :
      this.#repository.byToken(this.#members.realmId, token, Date.now());
  }

  bySubject(
    subject: string
  ): ShareLink | null {
    if (!subject.startsWith(kSubjectPrefix)) {
      return null;
    }

    return this.#repository.byId(
      this.#members.realmId,
      subject.slice(kSubjectPrefix.length),
      Date.now()
    );
  }

  visibleTo(
    actorId: string
  ): ShareLink[] {
    const links = this.#repository.live(this.#members.realmId, Date.now());

    return this.#members.isAdmin(actorId) ?
      links :
      links.filter((link) => link.createdBy === actorId);
  }

  revoke(
    actorId: string,
    linkId: string
  ): ShareLink {
    const link = this.#repository.byId(
      this.#members.realmId,
      linkId,
      Date.now()
    );
    if (link === null) {
      throw new ShareLinkNotFoundError();
    }
    if (link.createdBy !== actorId && !this.#members.isAdmin(actorId)) {
      throw new ShareLinkRefusedError(
        "only its creator or an admin revokes a share link"
      );
    }

    this.#repository.delete(linkId);
    this.#members.revoke(shareLinkSubject(linkId));
    this.#members.record({
      type: "share-link-revoked",
      actorId,
      linkId,
      assetId: link.assetId
    });

    return link;
  }

  [Symbol.dispose](): void {
    if (this.#expiry !== null) {
      clearTimeout(this.#expiry);
      this.#expiry = null;
    }
  }

  #scheduleExpiry(): void {
    this[Symbol.dispose]();
    const next = this.#repository.nextExpiry(this.#members.realmId);
    if (next === null) {
      return;
    }

    const delay = Math.min(
      Math.max(next - Date.now(), 0),
      kMaxTimerDelayMs
    );
    this.#expiry = setTimeout(() => this.#expire(), delay);
    this.#expiry.unref?.();
  }

  #expire(): void {
    const expired = this.#repository.deleteExpired(
      this.#members.realmId,
      Date.now()
    );
    for (const link of expired) {
      this.#members.revoke(shareLinkSubject(link.id));
    }
    this.#scheduleExpiry();
  }
}
