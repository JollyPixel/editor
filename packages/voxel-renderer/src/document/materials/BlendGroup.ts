// CONSTANTS
const kMaxWidth = 64;
const kPatterns: readonly string[] = ["noise", "bayer"];

export type BlendPattern = "noise" | "bayer";

export interface BlendGroupJSON {
  id: string;
  /**
   * Texels a group bleeds into its neighbours, from 1 to 64.
   * @default 8
   */
  width?: number;
  /**
   * Per-texel threshold of the fade: hashed noise or a 4x4 ordered dither.
   * @default "noise"
   */
  pattern?: BlendPattern;
  /**
   * A group bleeds over lower ones and not onto higher ones; equal groups
   * share the edge.
   * @default 0
   */
  priority?: number;
  /**
   * Groups this one never blends with, in either direction.
   * @default []
   */
  exclude?: string[];
}

export type BlendGroupSettings = Required<Omit<BlendGroupJSON, "id">>;

export class BlendGroup {
  static readonly defaults: Readonly<
    Omit<BlendGroupSettings, "exclude">
  > = Object.freeze({
    width: 8,
    pattern: "noise",
    priority: 0
  });

  readonly id: string;
  readonly width: number;
  readonly pattern: BlendPattern;
  readonly priority: number;
  readonly exclude: readonly string[];

  static parse(
    value: unknown
  ): BlendGroup | null {
    return isBlendGroupJSON(value) ? new BlendGroup(value) : null;
  }

  constructor(
    json: BlendGroupJSON
  ) {
    const problem = validateFields(json);
    if (problem !== null) {
      throw new RangeError(problem);
    }

    const { defaults } = BlendGroup;
    this.id = json.id;
    this.width = json.width ?? defaults.width;
    this.pattern = json.pattern ?? defaults.pattern;
    this.priority = json.priority ?? defaults.priority;
    this.exclude = Object.freeze([...new Set(json.exclude ?? [])]);
    Object.freeze(this);
  }

  /**
   * Edge strength this group bleeds onto a face of `face`: 0 when it does
   * not, 0.5 when both share the edge, 1 when this group covers it.
   */
  bleedOnto(
    face: BlendGroup
  ): number {
    if (
      face.id === this.id ||
      this.exclude.includes(face.id) ||
      face.exclude.includes(this.id) ||
      this.priority < face.priority
    ) {
      return 0;
    }

    return this.priority === face.priority ? 0.5 : 1;
  }

  with(
    settings: Partial<BlendGroupSettings>
  ): BlendGroup {
    return new BlendGroup({
      ...this.toJSON(),
      ...settings,
      id: this.id
    });
  }

  equals(
    other: BlendGroup
  ): boolean {
    return this.id === other.id &&
      this.width === other.width &&
      this.pattern === other.pattern &&
      this.priority === other.priority &&
      this.exclude.length === other.exclude.length &&
      this.exclude.every((id, index) => other.exclude[index] === id);
  }

  toJSON(): Required<BlendGroupJSON> {
    return {
      id: this.id,
      width: this.width,
      pattern: this.pattern,
      priority: this.priority,
      exclude: [...this.exclude]
    };
  }
}

function isBlendGroupJSON(
  value: unknown
): value is BlendGroupJSON {
  return validateFields(value) === null;
}

function validateFields(
  value: unknown
): string | null {
  if (typeof value !== "object" || value === null) {
    return "Blend group must be an object.";
  }

  const fields: Map<string, unknown> = new Map(Object.entries(value));
  const id = fields.get("id");
  const width = fields.get("width");
  const pattern = fields.get("pattern");
  const priority = fields.get("priority");
  const exclude = fields.get("exclude");

  if (typeof id !== "string" || id === "") {
    return "Blend group id must be a non-empty string.";
  }
  if (
    width !== undefined &&
    (!Number.isInteger(width) || Number(width) < 1 || Number(width) > kMaxWidth)
  ) {
    return `Blend width must be an integer from 1 to ${kMaxWidth}.`;
  }
  if (
    pattern !== undefined &&
    (typeof pattern !== "string" || !kPatterns.includes(pattern))
  ) {
    return `Blend pattern must be one of: ${kPatterns.join(", ")}.`;
  }
  if (priority !== undefined && !Number.isInteger(priority)) {
    return "Blend priority must be an integer.";
  }
  if (
    exclude !== undefined &&
    (
      !Array.isArray(exclude) ||
      !exclude.every((entry) => typeof entry === "string" && entry !== "")
    )
  ) {
    return "Blend exclusions must be non-empty group ids.";
  }

  return null;
}
