// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Internal Dependencies
import type { AccountDirectory } from "../AccountDirectory.ts";
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
  #directory: AccountDirectory;
  #expiry: ReturnType<typeof setTimeout> | null = null;

  constructor(
    repository: ShareLinkRepository,
    directory: AccountDirectory
  ) {
    this.#repository = repository;
    this.#directory = directory;
    this.#scheduleExpiry();
  }

  create(
    creation: ShareLinkCreation
  ): ShareLink {
    const now = Date.now();
    if (creation.expiresAt !== null && creation.expiresAt <= now) {
      throw new RangeError("a share link must expire in the future");
    }
    if (this.#directory.account(creation.createdBy) === null) {
      throw new ShareLinkRefusedError("the creator has no account");
    }

    const link: ShareLink = {
      id: randomUUID(),
      token: SessionToken.mint().value,
      assetId: creation.assetId,
      createdBy: creation.createdBy,
      createdAt: now,
      expiresAt: creation.expiresAt
    };
    this.#repository.insert(link);
    this.#scheduleExpiry();
    this.#directory.record({
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
      this.#repository.byToken(token, Date.now());
  }

  bySubject(
    subject: string
  ): ShareLink | null {
    if (!subject.startsWith(kSubjectPrefix)) {
      return null;
    }

    return this.#repository.byId(
      subject.slice(kSubjectPrefix.length),
      Date.now()
    );
  }

  visibleTo(
    actorId: string
  ): ShareLink[] {
    const links = this.#repository.live(Date.now());

    return this.#directory.isAdmin(actorId) ?
      links :
      links.filter((link) => link.createdBy === actorId);
  }

  revoke(
    actorId: string,
    linkId: string
  ): ShareLink {
    const link = this.#repository.byId(linkId, Date.now());
    if (link === null) {
      throw new ShareLinkNotFoundError();
    }
    if (link.createdBy !== actorId && !this.#directory.isAdmin(actorId)) {
      throw new ShareLinkRefusedError(
        "only its creator or an admin revokes a share link"
      );
    }

    this.#repository.delete(linkId);
    this.#directory.revoke(shareLinkSubject(linkId));
    this.#directory.record({
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
    const next = this.#repository.nextExpiry();
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
    for (const link of this.#repository.deleteExpired(Date.now())) {
      this.#directory.revoke(shareLinkSubject(link.id));
    }
    this.#scheduleExpiry();
  }
}
