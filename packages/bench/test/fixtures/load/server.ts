// Import Node.js Dependencies
import http from "node:http";

// Import Internal Dependencies
import { runLoadServer } from "../../../src/index.ts";

const httpServer = http.createServer();

runLoadServer(httpServer, () => {
  httpServer.close();
});
