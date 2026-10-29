export type VoxelObjectProperties = Record<
  string,
  string | number | boolean
>;

export interface VoxelObjectJSON {
  id: string;
  name: string;
  type?: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible: boolean;
  color?: string;
  locked?: boolean;
  /**
   * Whether a scene can attach actors to the object.
   * @default false
   */
  anchor?: boolean;
  properties?: VoxelObjectProperties;
}

export interface VoxelObjectLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  objects: VoxelObjectJSON[];
}
