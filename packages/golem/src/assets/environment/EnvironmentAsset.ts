// Import Node.js Dependencies
import { isDeepStrictEqual } from "node:util";

// Import Third-party Dependencies
import { changedSections } from "@jolly-pixel/asset.environment";
import {
  createEnvironmentFile,
  EnvironmentSwitch,
  type SyncedEnvironmentDocument
} from "@jolly-pixel/asset.environment/client";
import type {
  EnvironmentCommand,
  EnvironmentFile,
  EnvironmentPresetName,
  EnvironmentSection
} from "@jolly-pixel/asset.environment/server";
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { GolemAsset } from "../GolemAsset.ts";
import type { EnvironmentPatch } from "./EnvironmentPatch.ts";

export interface EnvironmentChangeOptions {
  /**
   * Every section starts from this preset before the patch.
   * @default the environment as it is now
   */
  preset?: EnvironmentPresetName;
}

export class EnvironmentAsset extends GolemAsset<
  EnvironmentCommand,
  SyncedEnvironmentDocument
> {
  read(): EnvironmentFile {
    return structuredClone(this.synced.document.file);
  }

  async change(
    patch: EnvironmentPatch,
    options: EnvironmentChangeOptions = {}
  ): Promise<EnvironmentSection[]> {
    const current = this.synced.document.file;
    const next = patchedSections(
      options.preset === undefined ? current : createEnvironmentFile(options.preset),
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
