// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { AssetLeases } from "#src/lease/AssetLeases.ts";
import type { AssetLease } from "#src/lease/AssetLease.ts";
import {
  BenchClient,
  RecordMap,
  benchDocumentKind,
  dependencyRecords,
  type BenchDocument
} from "./_fixtures.ts";

// CONSTANTS
const kOpenCounts = [1, 20, 100];
const kKind = benchDocumentKind("pixelart");

interface OpenedLeases {
  leases: AssetLeases;
  held: AssetLease<BenchDocument>[];
  closedId: string;
}

function openLeases(
  count: number
): OpenedLeases {
  const records = dependencyRecords(count + 1);
  const leases = new AssetLeases({
    rooms: new BenchClient(),
    records: new RecordMap(records)
  });
  leases.on("unsaved", () => undefined);
  const held = records
    .slice(0, count)
    .map((record) => leases.open(kKind, record.id));

  return {
    leases,
    held,
    closedId: records[count].id
  };
}

const suite = defineSuite("lease / AssetLeases", (bench) => {
  const opened: AssetLeases[] = [];

  for (const count of kOpenCounts) {
    const { leases, held } = openLeases(count);
    opened.push(leases);
    const { changes } = held[0].document;

    bench.add(`edit then acknowledge, ${count} open`, batched(() => {
      changes.edit();
      changes.acknowledge();
    }));
  }

  const { leases, held, closedId } = openLeases(20);
  opened.push(leases);
  const heldId = held[0].record.id;

  bench
    .add("reopen a held asset", batched(() => {
      leases.open(kKind, heldId).release();
    }))
    .add("open and close an asset", batched(() => {
      leases.open(kKind, closedId).release();
    }));

  return () => {
    for (const disposed of opened) {
      disposed.dispose();
    }
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
