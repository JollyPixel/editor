// Import Third-party Dependencies
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Import Internal Dependencies
import GroupManager, { type GroupManagerOptions } from "./GroupManager.ts";
import {
  type GroupTransformSnapshot,
  type ModelHookEvent,
  type ModelHookListener
} from "./hooks.ts";
import {
  snapshotTransform,
  toEuler,
  toVector3
} from "./transformCodec.ts";
import {
  mirrorRotation,
  mirrorSignFromAxes,
  mirrorVector,
  type MirrorAxes
} from "./mirrorTransform.ts";

export interface ModelManagerOptions {
  scene: THREE.Scene;
  transformControl: TransformControls;
}

export default class ModelManager {
  private scene: THREE.Scene;
  private transformControl: TransformControls;
  private groups: GroupManager[] = [];
  private selectedGroup: GroupManager | null = null;
  private meshToGroupMap: Map<THREE.Mesh, GroupManager> = new Map();

  #muted = false;
  #flipAxesByUuid = new Map<string, MirrorAxes>();

  public onModelUpdated: ModelHookListener | undefined;

  constructor(options: ModelManagerOptions) {
    this.scene = options.scene;
    this.transformControl = options.transformControl;
  }

  public silently<T>(
    fn: () => T
  ): T {
    const previous = this.#muted;
    this.#muted = true;
    try {
      return fn();
    }
    finally {
      this.#muted = previous;
    }
  }

  #emit(
    event: ModelHookEvent
  ): void {
    if (!this.#muted) {
      this.onModelUpdated?.(event);
    }
  }

  public addGroup(options?: GroupManagerOptions): GroupManager {
    const group = new GroupManager(options);
    this.groups.push(group);

    this.meshToGroupMap.set(group.getMesh(), group);

    this.scene.add(group.getGroup());

    this.#emit({
      action: "group-added",
      uuid: group.getGroupUUID(),
      name: group.name,
      transform: snapshotTransform(group)
    });

    return group;
  }

  public removeGroup(group: GroupManager): void {
    const index = this.groups.indexOf(group);
    if (index === -1) {
      return;
    }

    if (this.selectedGroup === group) {
      this.selectGroup(null);
    }

    const uuid = group.getGroupUUID();

    this.meshToGroupMap.delete(group.getMesh());
    this.#flipAxesByUuid.delete(uuid);

    group.dispose();

    this.groups.splice(index, 1);

    this.#emit({ action: "group-removed", uuid });
  }

  public renameGroup(
    uuid: string,
    name: string
  ): void {
    const group = this.getGroupByUUID(uuid);
    if (!group) {
      return;
    }

    group.name = name;
    this.#emit({ action: "group-renamed", uuid, name });
  }

  public commitGroupTransform(
    uuid: string
  ): void {
    const group = this.getGroupByUUID(uuid);
    if (!group) {
      return;
    }

    this.#emit({
      action: "group-transformed",
      uuid,
      transform: snapshotTransform(group)
    });
  }

  public applyRemoteCommand(
    cmd: ModelHookEvent
  ): void {
    this.silently(() => {
      switch (cmd.action) {
        case "group-added":
          if (this.getGroupByUUID(cmd.uuid) !== undefined) {
            break;
          }
          this.addGroup({
            uuid: cmd.uuid,
            name: cmd.name,
            pos: toVector3(cmd.transform.position),
            pivotPos: toVector3(cmd.transform.pivotOffset),
            size: toVector3(cmd.transform.size),
            scale: toVector3(cmd.transform.scale),
            rotation: toEuler(cmd.transform.rotation)
          });
          break;

        case "group-removed": {
          const group = this.getGroupByUUID(cmd.uuid);
          if (group) {
            this.removeGroup(group);
          }
          break;
        }

        case "group-renamed":
          this.renameGroup(cmd.uuid, cmd.name);
          break;

        case "group-reparented":
          this.reparent(cmd.uuid, cmd.parentUuid);
          this.#applyTransform(cmd.uuid, cmd.transform);
          break;

        case "group-reparented-local":
          this.reparentLocal(cmd.uuid, cmd.parentUuid);
          break;

        case "group-transformed":
          this.#applyTransform(cmd.uuid, cmd.transform);
          if (cmd.flipAxes) {
            this.setFlipAxes(cmd.uuid, cmd.flipAxes);
          }
          break;

        default: {
          const unhandled: never = cmd;
          throw new Error(
            `applyRemoteCommand: unhandled action '${(unhandled as ModelHookEvent).action}'.`
          );
        }
      }
    });
  }

  #applyTransform(
    uuid: string,
    transform: GroupTransformSnapshot
  ): void {
    const group = this.getGroupByUUID(uuid);
    if (!group) {
      return;
    }

    group.setPosition(toVector3(transform.position));
    group.setPivotOffset(toVector3(transform.pivotOffset));
    group.setRotation(toEuler(transform.rotation));
    group.setScale(toVector3(transform.scale));
    group.resize(toVector3(transform.size));
  }

  public selectGroup(group: GroupManager | null): void {
    if (this.selectedGroup && this.selectedGroup !== group) {
      this.selectedGroup.deselect();
    }

    this.selectedGroup = group;

    if (!group) {
      this.transformControl.detach();

      return;
    }

    group.select();
    this.transformControl.attach(group.getGroup());
    this.scene.add(this.transformControl.getHelper());
  }

  public getSelectedGroup(): GroupManager | null {
    return this.selectedGroup;
  }

  public getGroups(): GroupManager[] {
    return this.groups;
  }

  public getGroupByMesh(mesh: THREE.Mesh): GroupManager | undefined {
    return this.meshToGroupMap.get(mesh);
  }

  public getGroupByUUID(uuid: string): GroupManager | undefined {
    return this.groups.find((group) => group.getGroupUUID() === uuid);
  }

  public getParentUUID(uuid: string): string | null {
    const group = this.getGroupByUUID(uuid);
    if (!group) {
      return null;
    }

    const parentObject = group.getGroup().parent;

    for (const candidate of this.groups) {
      if (candidate.getPivot() === parentObject) {
        return candidate.getGroupUUID();
      }
    }

    return null;
  }

  public duplicateGroup(
    sourceUuid: string,
    name?: string
  ): GroupManager | null {
    const source = this.getGroupByUUID(sourceUuid);
    if (!source) {
      return null;
    }

    return this.addGroup({
      pos: source.getPosition(),
      pivotPos: source.getPivotOffset(),
      size: source.getSize(),
      scale: source.getScale(),
      rotation: source.getRotation(),
      name: name ?? source.name
    });
  }

  public mirrorGroups(
    uuids: Iterable<string>,
    axes: MirrorAxes
  ): void {
    const sign = mirrorSignFromAxes(axes);
    const snapshots = [...uuids]
      .map((uuid) => this.getGroupByUUID(uuid))
      .filter((group): group is GroupManager => group !== undefined)
      .map((group) => {
        return {
          group,
          position: group.getPositionWorld(),
          rotation: group.getRotationWorld(),
          pivotOffset: group.getPivotOffsetWorld()
        };
      });

    for (const { group, position, rotation, pivotOffset } of snapshots) {
      group.setPositionWorld(mirrorVector(position, sign));
      this.scene.updateMatrixWorld(true);
      group.setRotationWorld(mirrorRotation(rotation, sign));
      group.setPivotOffsetWorld(mirrorVector(pivotOffset, sign));
      this.scene.updateMatrixWorld(true);

      const uuid = group.getGroupUUID();
      this.setFlipAxes(uuid, axes);
      this.#emit({
        action: "group-transformed",
        uuid,
        transform: snapshotTransform(group),
        flipAxes: axes
      });
    }
  }

  public setFlipAxes(
    uuid: string,
    axes: MirrorAxes
  ): void {
    this.#flipAxesByUuid.set(uuid, axes);
  }

  public getFlipAxes(uuid: string): MirrorAxes | undefined {
    return this.#flipAxesByUuid.get(uuid);
  }

  public reparent(
    childUuid: string,
    parentUuid: string | null
  ): void {
    const child = this.getGroupByUUID(childUuid);
    if (!child) {
      return;
    }

    if (parentUuid === null) {
      this.scene.attach(child.getGroup());
    }
    else {
      const parent = this.getGroupByUUID(parentUuid);
      if (!parent) {
        return;
      }

      parent.getPivot().attach(child.getGroup());
    }

    this.#emit({
      action: "group-reparented",
      uuid: childUuid,
      parentUuid,
      transform: snapshotTransform(child)
    });
  }

  public reparentAtParentPosition(
    childUuid: string,
    parentUuid: string
  ): void {
    const child = this.getGroupByUUID(childUuid);
    const parent = this.getGroupByUUID(parentUuid);
    if (!child || !parent) {
      return;
    }

    child.setPositionWorld(parent.getPositionWorld());
    this.reparent(childUuid, parentUuid);
  }

  public reparentLocal(
    childUuid: string,
    parentUuid: string | null
  ): void {
    const child = this.getGroupByUUID(childUuid);
    if (!child) {
      return;
    }

    if (parentUuid === null) {
      this.scene.add(child.getGroup());
    }
    else {
      const parent = this.getGroupByUUID(parentUuid);
      if (!parent) {
        return;
      }

      parent.getPivot().add(child.getGroup());
    }

    this.#emit({
      action: "group-reparented-local",
      uuid: childUuid,
      parentUuid
    });
  }

  public setTextureForAll(texture: THREE.Texture | null): void {
    this.groups.forEach((group) => {
      group.setTexture(texture);
    });
  }

  public disposeAll(): void {
    const groupsCopy = [...this.groups];
    groupsCopy.forEach((group) => {
      this.removeGroup(group);
    });
  }
}
