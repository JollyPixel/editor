export interface ProjectEntry {
  slug: string;
  root: string;
}

export interface ProjectRegistry {
  resolve(slug: string): Promise<string | null>;
  list(): Promise<ProjectEntry[]>;
  create(slug: string): Promise<string>;
}
