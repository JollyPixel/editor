// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { ClientSessions } from "#src/server/ClientSessions.ts";

// CONSTANTS
const kClients = ["A", "B"];
const kLanes = ["room-1", "room-2", "room-3"];

interface LaneTask {
  client: string;
  lane: string;
  fails: boolean;
}

interface TaskRecord {
  started: boolean;
  ended: boolean;
  settled: "pending" | "resolved" | "rejected";
}

const kTask: fc.Arbitrary<LaneTask> = fc.record({
  client: fc.constantFrom(...kClients),
  lane: fc.constantFrom(...kLanes),
  fails: fc.boolean()
});
const kStuck = fc.option(
  fc.record({
    client: fc.constantFrom(...kClients),
    lane: fc.constantFrom(...kLanes)
  }),
  { nil: undefined }
);

function laneOf(
  task: { client: string; lane: string; }
): string {
  return `${task.client}/${task.lane}`;
}

describe("ClientSessions properties", () => {
  test("each lane runs its tasks one at a time in order, and only a stuck lane blocks", async() => {
    await fc.assert(
      fc.asyncProperty(
        fc.scheduler(),
        fc.array(kTask, { maxLength: 12 }),
        kStuck,
        async(scheduler, tasks, stuck) => {
          const sessions = new ClientSessions();
          const records: TaskRecord[] = tasks.map(() => {
            return { started: false, ended: false, settled: "pending" };
          });
          const active = new Map<string, number>();
          const order = new Map<string, number[]>();
          const stuckLane = stuck === undefined ? null : laneOf(stuck);

          tasks.forEach((task, index) => {
            const lane = laneOf(task);
            sessions.enqueue(task.client, async() => {
              records[index].started = true;
              order.set(lane, [...order.get(lane) ?? [], index]);
              active.set(lane, (active.get(lane) ?? 0) + 1);
              assert.strictEqual(active.get(lane), 1);

              await (lane === stuckLane ?
                new Promise(() => void 0) :
                scheduler.schedule(Promise.resolve(), `task ${index}`));
              active.set(lane, (active.get(lane) ?? 0) - 1);
              records[index].ended = true;
              if (task.fails) {
                throw new Error(`task ${index} failed`);
              }
            }, task.lane).then(
              () => (records[index].settled = "resolved"),
              () => (records[index].settled = "rejected")
            );
          });
          const drained = new Map(kClients.map((client) => [client, false]));
          for (const client of kClients) {
            void sessions.drain(client).then(() => {
              assert.ok(tasks.every((task, index) => task.client !== client || records[index].ended));
              drained.set(client, true);
            });
          }

          await setImmediate();
          while (scheduler.count() > 0) {
            await scheduler.waitAll();
            await setImmediate();
          }

          for (const [lane, indices] of order) {
            assert.deepStrictEqual(indices, indices.toSorted((a, b) => a - b), lane);
          }
          tasks.forEach((task, index) => {
            const lane = laneOf(task);
            const record = records[index];
            if (lane === stuckLane) {
              const first = tasks.findIndex((candidate) => laneOf(candidate) === lane);
              assert.strictEqual(record.started, index === first);
              assert.strictEqual(record.settled, "pending");
            }
            else {
              assert.ok(record.ended);
              assert.strictEqual(record.settled, task.fails ? "rejected" : "resolved");
            }
          });

          const blocked = tasks.some((task) => laneOf(task) === stuckLane);
          for (const client of kClients) {
            assert.strictEqual(drained.get(client), !(blocked && stuck?.client === client));
          }
          assert.strictEqual(sessions.pending, blocked ? 1 : 0);
        }
      )
    );
  });
});
