// Import Third-party Dependencies
import {
  KindFilter,
  type GameSection,
  type PhysicsSection,
  type ProjectSettingsReply,
  type SnapshotSection,
  type SettingsSectionBody,
  type SettingsSectionName
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { AccessDraft } from "./AccessDraft.ts";
import { KindOptionsDraft } from "./KindOptionsDraft.ts";
import { SectionDraft } from "./SectionDraft.ts";

interface DraftValues {
  kinds: KindOptionsDraft;
  access: AccessDraft;
  kindFilter: KindFilter;
  game: GameSection;
  physics: PhysicsSection;
  snapshot: SnapshotSection;
}

export type DraftValue<
  TName extends SettingsSectionName
> = DraftValues[TName];

type SectionDrafts = {
  readonly [TName in SettingsSectionName]: SectionDraft<TName, DraftValue<TName>>;
};

export type DraftBodies = {
  [TName in SettingsSectionName]: SettingsSectionBody<TName> | undefined;
};

export class ProjectDrafts {
  #drafts: SectionDrafts;

  constructor(
    changed: () => void
  ) {
    this.#drafts = {
      kinds: new SectionDraft({
        saved: (reply) => KindOptionsDraft.from(reply.kinds),
        body: (draft) => draft.toJSON()
      }, changed),
      access: new SectionDraft({
        saved: (reply) => (
          reply.access === undefined ? null : AccessDraft.from(reply.access)
        ),
        body: (draft) => draft.toChange()
      }, changed),
      kindFilter: new SectionDraft({
        saved: (reply) => KindFilter.from(reply.kindFilter),
        body: (draft) => draft.toJSON()
      }, changed),
      game: new SectionDraft({
        saved: (reply) => reply.game,
        body: (game) => game
      }, changed),
      physics: new SectionDraft({
        saved: (reply) => reply.physics,
        body: (physics) => physics
      }, changed),
      snapshot: new SectionDraft({
        saved: (reply) => reply.snapshot,
        body: (snapshot) => snapshot
      }, changed)
    };
  }

  get changed(): boolean {
    return Object.values(this.#drafts).some((draft) => draft.changed);
  }

  section<TName extends SettingsSectionName>(
    name: TName
  ): SectionDraft<TName, DraftValue<TName>> {
    return this.#drafts[name];
  }

  changedIn(
    sections: Iterable<SettingsSectionName>
  ): boolean {
    return Array.from(sections).some((name) => this.#drafts[name].changed);
  }

  edit<TName extends SettingsSectionName>(
    name: TName,
    value: DraftValue<TName>
  ): void {
    this.section(name).edit(value);
  }

  rebase(
    reply: ProjectSettingsReply
  ): void {
    for (const draft of Object.values(this.#drafts)) {
      draft.rebase(reply);
    }
  }

  sections(): DraftBodies {
    const drafts = this.#drafts;

    return {
      kinds: drafts.kinds.body(),
      access: drafts.access.body(),
      kindFilter: drafts.kindFilter.body(),
      game: drafts.game.body(),
      physics: drafts.physics.body(),
      snapshot: drafts.snapshot.body()
    };
  }

  discard(): void {
    for (const draft of Object.values(this.#drafts)) {
      draft.discard();
    }
  }
}
