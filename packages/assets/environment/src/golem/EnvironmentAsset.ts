// Import Node.js Dependencies
import { isDeepStrictEqual } from "node:util";

// Import Third-party Dependencies
import { GolemAsset } from "@jolly-pixel/golem.kit";
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { createEnvironmentFile } from "../asset/environment.ts";
import { changedSections } from "../model/EnvironmentState.ts";
import { EnvironmentSwitch } from "../model/EnvironmentSwitch.ts";
import type { SyncedEnvironmentDocument } from "../network/environmentDocumentKind.ts";
import type {
  EnvironmentChange,
  EnvironmentPatch
} from "./EnvironmentPatch.ts";
import type {
  EnvironmentCommand,
  EnvironmentFile,
  EnvironmentSection
} from "../network/types.ts";

export class EnvironmentAsset extends GolemAsset<
  EnvironmentCommand,
  SyncedEnvironmentDocument
> {
  read(): EnvironmentFile {
    return structuredClone(this.synced.document.file);
  }

  async change(
    input: EnvironmentChange
  ): Promise<EnvironmentSection[]> {
    const { preset, ...patch } = input;
    const current = this.synced.document.file;
    const next = patchedSections(
      preset === undefined ? current : createEnvironmentFile(preset),
      patch
    );

    const changed = changedSections(next).filter(
      (section) => !isDeepStrictEqual(next[section], current[section])
    );
    if (changed.length > 0) {
      await this.apply([{
        action: "environment-changed",
        set: Object.fromEntries(
          changed.map((section) => [section, next[section]])
        )
      }]);
    }

    return changed;
  }

  protected focus(): PeerMetadata | null {
    return null;
  }
}

function patchedSections(
  base: Readonly<EnvironmentFile>,
  patch: EnvironmentPatch
): Pick<EnvironmentFile, EnvironmentSection> {
  return {
    sky: merged(
      "sky",
      base.sky,
      patch.sky,
      (sky, { kind = sky.kind }) => EnvironmentSwitch.sky(sky, kind)
    ),
    sun: patch.sun === null ? null : merged(
      "sun",
      base.sun,
      patch.sun,
      (sun) => EnvironmentSwitch.sun(sun, true)
    ),
    ambient: merged("ambient", base.ambient, patch.ambient),
    reflections: merged("reflections", base.reflections, patch.reflections),
    fog: merged(
      "fog",
      base.fog,
      patch.fog,
      (fog, { kind = fog.kind }) => EnvironmentSwitch.fog(fog, kind)
    ),
    toneMapping: merged("toneMapping", base.toneMapping, patch.toneMapping),
    glow: patch.glow === null ? null : merged(
      "glow",
      base.glow,
      patch.glow,
      (glow) => EnvironmentSwitch.glow(glow, true)
    ),
    voxel: merged("voxel", base.voxel, patch.voxel)
  };
}

function merged<TValue, TFields extends object>(
  section: EnvironmentSection,
  value: TValue,
  fields: TFields | undefined,
  start: (value: TValue, fields: TFields) => TValue = (value) => value
): TValue {
  if (fields === undefined) {
    return value;
  }

  const from = start(value, fields);
  const stray = Object.keys(fields)
    .find((field) => !Object.hasOwn(Object(from), field));
  if (stray !== undefined) {
    throw new TypeError(
      `${section}.${stray} does not apply to ${JSON.stringify(from)}.`
    );
  }

  return {
    ...from,
    ...fields
  };
}
