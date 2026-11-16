// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";
import type { Infer } from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  environmentCommandSchema,
  environmentFileSchema
} from "../src/network/EnvironmentCommand.schema.ts";
import type {
  EnvironmentCommand,
  EnvironmentFile
} from "../src/network/types.ts";

describe("environment schemas", () => {
  test("validate the file the engine reads, and nothing else", () => {
    expect<Infer<typeof environmentFileSchema>>().type.toBeAssignableTo<EnvironmentFile>();
    expect<EnvironmentFile>().type.toBeAssignableTo<Infer<typeof environmentFileSchema>>();
  });

  test("validate the command the document writes, and nothing else", () => {
    expect<Infer<typeof environmentCommandSchema>>().type.toBeAssignableTo<EnvironmentCommand>();
    expect<EnvironmentCommand>().type.toBeAssignableTo<Infer<typeof environmentCommandSchema>>();
  });
});
