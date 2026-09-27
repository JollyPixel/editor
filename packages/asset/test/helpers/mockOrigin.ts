// Import Node.js Dependencies
import {
  after,
  before,
  beforeEach
} from "node:test";

// Import Third-party Dependencies
import {
  getGlobalDispatcher,
  setGlobalDispatcher,
  MockAgent,
  type Dispatcher,
  type Interceptable
} from "undici";

// CONSTANTS
export const MOCK_ORIGIN = "http://localhost";

export interface MockOrigin {
  intercept(
    path: string
  ): ReturnType<Interceptable["intercept"]>;
}

export function mockOrigin(): MockOrigin {
  let originalDispatcher: Dispatcher;
  let agent: MockAgent | undefined;

  before(() => {
    originalDispatcher = getGlobalDispatcher();
  });

  beforeEach(async() => {
    await agent?.close();
    agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
  });

  after(async() => {
    await agent?.close();
    setGlobalDispatcher(originalDispatcher);
  });

  return {
    intercept(path) {
      if (agent === undefined) {
        throw new Error("mockOrigin() intercepts only inside a test.");
      }

      return agent
        .get(MOCK_ORIGIN)
        .intercept({
          path,
          method: "GET"
        });
    }
  };
}
