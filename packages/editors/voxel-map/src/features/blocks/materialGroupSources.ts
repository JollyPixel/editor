// Import Third-party Dependencies
import type { FieldSource } from "@jolly-pixel/ui";
import {
  MaterialGroup,
  type MaterialGroupFinish
} from "@jolly-pixel/voxel.renderer";

export interface MaterialGroupPort {
  groupId(): string | undefined;
  group(): MaterialGroup | undefined;
  define(group: MaterialGroup): void;
  remove(groupId: string): void;
}

export function materialGroupNameOf(
  value: string
): string | undefined {
  const name = value.trim();

  return name === "" ? undefined : name;
}

export function customFinishSource(
  port: MaterialGroupPort
): FieldSource<boolean> {
  return {
    read: () => port.group() !== undefined,
    write: (value) => {
      const groupId = port.groupId();
      if (groupId === undefined || value === (port.group() !== undefined)) {
        return;
      }

      if (value) {
        port.define(new MaterialGroup({ id: groupId }));
      }
      else {
        port.remove(groupId);
      }
    }
  };
}

export function materialFinishSource<
  TField extends keyof MaterialGroupFinish
>(
  port: MaterialGroupPort,
  field: TField
): FieldSource<MaterialGroupFinish[TField]> {
  return {
    read: () => (port.group() ?? MaterialGroup.defaults)[field],
    write: (value) => {
      const group = port.group();
      if (group === undefined) {
        return;
      }

      const finish: Partial<MaterialGroupFinish> = {};
      finish[field] = value;
      const next = MaterialGroup.parse({
        ...group.toJSON(),
        ...finish
      });
      if (next !== null && !next.equals(group)) {
        port.define(next);
      }
    }
  };
}
