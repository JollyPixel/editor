export interface ProjectEntry {
  slug: string;
  root: string;
}

export interface ProjectRegistry {
  resolve(slug: string): Promise<string | null>;
  list(): Promise<ProjectEntry[]>;
  create(slug: string): Promise<string>;
  rename(slug: string, to: string): Promise<string>;
  remove(slug: string): Promise<void>;
}
