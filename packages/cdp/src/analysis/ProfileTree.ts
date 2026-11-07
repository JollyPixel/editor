// Import Node.js Dependencies
import { readFileSync } from "node:fs";

// Import Internal Dependencies
import type { CallFrame } from "./CallFrame.ts";
import { ProfileMeasure } from "./ProfileMeasure.ts";
import { Tally } from "./Tally.ts";
import { TimeWindow } from "./TimeWindow.ts";

interface CpuProfileNode {
  id: number;
  callFrame: CallFrame;
  children?: number[];
}

interface CpuProfile {
  nodes: CpuProfileNode[];
  samples: number[];
  timeDeltas: number[];
}

interface HeapProfileNode {
  id: number;
  callFrame: CallFrame;
  selfSize: number;
  children: HeapProfileNode[];
}

interface HeapProfile {
  head: HeapProfileNode;
}

export interface ProfileNode {
  readonly frame: CallFrame;
  readonly weight: number;
  stack(): IterableIterator<CallFrame>;
}

// CONSTANTS
const kAlways = TimeWindow.between();

export class ProfileTree {
  readonly measure: ProfileMeasure;
  readonly #weights = new Tally<number>();
  readonly #frames = new Map<number, CallFrame>();
  readonly #parents = new Map<number, number>();

  static read(
    file: string,
    window: TimeWindow = kAlways
  ): ProfileTree {
    const profile = JSON.parse(readFileSync(file, "utf8"));

    return "head" in profile ?
      ProfileTree.fromHeapProfile(profile) :
      ProfileTree.fromCpuProfile(profile, window);
  }

  static fromCpuProfile(
    profile: CpuProfile,
    window: TimeWindow = kAlways
  ): ProfileTree {
    const tree = new ProfileTree(ProfileMeasure.selfTime);
    for (const node of profile.nodes) {
      tree.#frames.set(node.id, node.callFrame);
      for (const child of node.children ?? []) {
        tree.#parents.set(child, node.id);
      }
    }

    let elapsed = 0;
    for (let index = 0; index < profile.samples.length; index++) {
      elapsed += profile.timeDeltas[index];
      if (window.contains(elapsed)) {
        tree.#weights.add(profile.samples[index], profile.timeDeltas[index + 1] ?? 0);
      }
    }

    return tree;
  }

  static fromHeapProfile(
    profile: HeapProfile
  ): ProfileTree {
    const tree = new ProfileTree(ProfileMeasure.allocated);
    const pending = [profile.head];
    for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
      tree.#frames.set(node.id, node.callFrame);
      if (node.selfSize > 0) {
        tree.#weights.add(node.id, node.selfSize);
      }
      for (const child of node.children) {
        tree.#parents.set(child.id, node.id);
        pending.push(child);
      }
    }

    return tree;
  }

  constructor(
    measure: ProfileMeasure
  ) {
    this.measure = measure;
  }

  get total(): number {
    return this.#weights.total;
  }

  * nodes(): IterableIterator<ProfileNode> {
    for (const { key: id, total } of this.#weights) {
      yield {
        frame: this.#frame(id),
        weight: total,
        stack: () => this.#stack(id)
      };
    }
  }

  #frame(
    id: number
  ): CallFrame {
    const callFrame = this.#frames.get(id);
    if (callFrame === undefined) {
      throw new Error(`Unknown profile node ${id}`);
    }

    return callFrame;
  }

  * #stack(
    id: number
  ): IterableIterator<CallFrame> {
    for (
      let cursor: number | undefined = id;
      cursor !== undefined;
      cursor = this.#parents.get(cursor)
    ) {
      const callFrame = this.#frame(cursor);
      if (callFrame.functionName !== "(root)") {
        yield callFrame;
      }
    }
  }
}
