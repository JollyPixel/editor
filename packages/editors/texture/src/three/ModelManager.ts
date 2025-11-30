// Import Third-party Dependencies
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/Addons.js";

// Import Internal Dependencies
import GroupManager, { type GroupManagerOptions } from "./GroupManager.js";

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

  constructor(options: ModelManagerOptions) {
    this.scene = options.scene;
    this.transformControl = options.transformControl;
  }

  public addGroup(options?: GroupManagerOptions): GroupManager {
    const group = new GroupManager(options);
    this.groups.push(group);

    // Map mesh to group for quick lookup
    this.meshToGroupMap.set(group.getMesh(), group);

    // Add group to scene
    this.scene.add(group.getGroup());

    return group;
  }

  public removeGroup(group: GroupManager): void {
    const index = this.groups.indexOf(group);
    if (index === -1) {
      return;
    }

    // If this is the selected group, deselect it
    if (this.selectedGroup === group) {
      this.selectGroup(null);
    }

    // Remove from map
    this.meshToGroupMap.delete(group.getMesh());

    // Dispose resources
    group.dispose();

    // Remove from array
    this.groups.splice(index, 1);
  }

  public selectGroup(group: GroupManager | null): void {
    // Deselect previous group
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

  public setTextureForAll(texture: THREE.Texture | null): void {
    this.groups.forEach((group) => {
      group.setTexture(texture);
    });
  }

  public disposeAll(): void {
    // Create a copy of the array since removeGroup modifies it
    const groupsCopy = [...this.groups];
    groupsCopy.forEach((group) => {
      this.removeGroup(group);
    });
  }
}
