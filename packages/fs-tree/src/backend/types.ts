export type FSTreeTag = string | null;

export type FSTreeType = "file" | "directory";

export type FSTreeDirent = {
  name: string;
  type: FSTreeType;
  parentPath: string;
};
export type FSTreeOptionalDirent = Omit<FSTreeDirent, "type">;

export type FSTreeFile = {
  name: string;
};

export type FSTreeVertex<T extends FSTreeFile = FSTreeFile> = {
  files: T[];
};

export type FSTreeFsOperations<T extends FSTreeFile = FSTreeFile> =
  | { action: "mkdir" | "rmdir"; from: string; }
  | { action: "mvdir" | "copy"; from: string; to: string; }
  | { action: "append" | "unlink"; file: T; }
  | { action: "update"; previousFile: T; file: T; };
