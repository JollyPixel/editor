// Import Third-party Dependencies
import { expect, test } from "tstyche";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

// Import Internal Dependencies
import {
  loadBlocksets,
  type TextureSourceLoader
} from "../../../src/index.ts";

test("a KTX2Loader loads blockset atlases", () => {
  expect<KTX2Loader>().type.toBeAssignableTo<TextureSourceLoader>();
  expect(loadBlocksets).type.toBeCallableWith([], {
    loader: new KTX2Loader()
  });
});
