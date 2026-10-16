// Import Node.js Dependencies
import { readFileSync } from "node:fs";

// Import Internal Dependencies
import type { CallFrame } from "./FrameLocator.ts";
import { Tally } from "./Tally.ts";

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

export type ProfileUnit = "us" | "bytes";

export interface ProfileWindow {
  fromMs?: number;
  untilMs?: number;
}

export class ProfileTree {
  readonly unit: ProfileUnit;
  readonly weights = new Tally<number>();
  readonly #frames = new Map<number, CallFrame>();
  readonly #parents = new Map<number, number>();

  static read(
    file: string,
    window: ProfileWindow = {}
  ): ProfileTree {
    const profile = JSON.parse(readFileSync(file, "utf8"));

    return "head" in profile ?
      ProfileTree.fromHeapProfile(profile) :
      ProfileTree.fromCpuProfile(profile, window);
  }

  static fromCpuProfile(
    profile: CpuProfile,
    window: ProfileWindow = {}
  ): ProfileTree {
    const tree = new ProfileTree("us");
    for (const node of profile.nodes) {
      tree.#frames.set(node.id, node.callFrame);
      for (const child of node.children ?? []) {
        tree.#parents.set(child, node.id);
      }
    }

    const from = (window.fromMs ?? -Infinity) * 1000;
    const until = (window.untilMs ?? Infinity) * 1000;
    let elapsed = 0;
    for (let index = 0; index < profile.samples.length; index++) {
      elapsed += profile.timeDeltas[index];
      if (elapsed >= from && elapsed <= until) {
        tree.weights.add(profile.samples[index], profile.timeDeltas[index + 1] ?? 0);
      }
    }

    return tree;
  }

  static fromHeapProfile(
    profile: HeapProfile
  ): ProfileTree {
    const tree = new ProfileTree("bytes");
    const pending = [profile.head];
    for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
      tree.#frames.set(node.id, node.callFrame);
      if (node.selfSize > 0) {
        tree.weights.add(node.id, node.selfSize);
      }
      for (const child of node.children) {
        tree.#parents.set(child.id, node.id);
        pending.push(child);
      }
    }

    return tree;
  }

  static totalAllocated(
    profile: HeapProfile
  ): number {
    return ProfileTree.fromHeapProfile(profile).weights.total;
  }

  constructor(
    unit: ProfileUnit
  ) {
    this.unit = unit;
  }

  frame(
    id: number
  ): CallFrame {
    const callFrame = this.#frames.get(id);
    if (callFrame === undefined) {
      throw new Error(`Unknown profile node ${id}`);
    }

    return callFrame;
  }

  * callers(
    id: number
  ): IterableIterator<CallFrame> {
    for (
      let cursor: number | undefined = id;
      cursor !== undefined;
      cursor = this.#parents.get(cursor)
    ) {
      const callFrame = this.frame(cursor);
      if (callFrame.functionName !== "(root)") {
        yield callFrame;
      }
    }
  }
}
