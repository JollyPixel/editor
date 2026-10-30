export interface TextureFileDrop {
  /**
   * MIME types it claims while dragged and on drop, such as `"application/zip"`.
   */
  readonly types: readonly string[];
  /**
   * File name endings claimed on drop, such as `".zip"`.
   */
  readonly extensions: readonly string[];
  /**
   * Overlay text shown while a claimed file is dragged.
   */
  readonly label: string;
  drop(file: File): void;
}

export interface DraggedFile {
  readonly type: string;
  readonly name?: string;
}

export function claimingDrop(
  drops: readonly TextureFileDrop[],
  file: DraggedFile
): TextureFileDrop | undefined {
  const name = file.name?.toLowerCase() ?? "";

  return drops.find(
    (drop) => drop.types.includes(file.type) ||
      drop.extensions.some((extension) => name.endsWith(extension))
  );
}
