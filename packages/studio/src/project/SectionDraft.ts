// Import Third-party Dependencies
import type {
  ProjectSettingsReply,
  SettingsSectionBody,
  SettingsSectionName
} from "@jolly-pixel/server";

export interface SectionCodec<
  TName extends SettingsSectionName,
  TValue
> {
  saved(reply: ProjectSettingsReply): TValue | null;
  body(value: TValue): SettingsSectionBody<TName>;
}

export class SectionDraft<
  TName extends SettingsSectionName,
  TValue
> {
  #codec: SectionCodec<TName, TValue>;
  #changed: () => void;
  #saved: TValue | null = null;
  #edited: TValue | null = null;

  constructor(
    codec: SectionCodec<TName, TValue>,
    changed: () => void
  ) {
    this.#codec = codec;
    this.#changed = changed;
  }

  get saved(): TValue | null {
    return this.#saved;
  }

  get current(): TValue | null {
    return this.#edited ?? this.#saved;
  }

  get changed(): boolean {
    return this.#edited !== null;
  }

  differsIn(
    part: (value: TValue) => unknown
  ): boolean {
    return this.#edited !== null && this.#differs(this.#edited, part);
  }

  rebase(
    reply: ProjectSettingsReply
  ): void {
    this.#saved = this.#codec.saved(reply);
    if (this.#edited !== null && !this.#differs(this.#edited)) {
      this.#edited = null;
    }
  }

  edit(
    value: TValue
  ): void {
    this.#edited = this.#differs(value) ? value : null;
    this.#changed();
  }

  discard(): void {
    this.#edited = null;
  }

  body(): SettingsSectionBody<TName> | undefined {
    return this.#edited === null ? undefined : this.#codec.body(this.#edited);
  }

  #differs(
    value: TValue,
    part: (value: TValue) => unknown = (whole) => whole
  ): boolean {
    return this.#saved === null ||
      JSON.stringify(part(value)) !== JSON.stringify(part(this.#saved));
  }
}
