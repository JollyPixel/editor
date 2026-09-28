// Import Third-party Dependencies
import { expect, test } from "tstyche";
import type {
  MetricDefinition,
  MetricSource
} from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import {
  VoxelInspector,
  type VoxelMetric
} from "../../../src/index.ts";

test("voxel metrics satisfy the recorder contract by shape alone", () => {
  expect<VoxelMetric>().type.toBeAssignableTo<MetricDefinition>();
  expect<VoxelInspector>().type.toBeAssignableTo<MetricSource>();
});
