// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { ResultsFile } from "../report/ResultsFile.ts";
import type { EditMeasurement } from "./Sample.ts";
import { editSummary } from "./Summary.ts";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    control: { type: "string" }
  }
});

const measurements = positionals.flatMap(
  (target) => ResultsFile.read<EditMeasurement>(target, "edit")
);
console.log(editSummary(measurements, args.control));
