// Import Third-party Dependencies
import { Server } from "socket.io";

// Import Internal Dependencies
import { FSTree } from "../src/backend/FSTree.class.js";

const [treeRootPath] = process.argv.slice(2);
if (typeof treeRootPath !== "string") {
  throw new Error("Please provide the path to the FSTree root directory as an argument.");
}

const io = new Server(3000, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const fsTree = await FSTree.loadFromPath(treeRootPath);

console.log(`FSTree server listening on port ${3000}`);
console.log(`Monitoring FSTree at: ${treeRootPath}`);

fsTree.on(FSTree.Event, (event) => {
  console.log("FSTree change event:", event);
  io.emit("fsTreeChange", event);
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.emit("initialFSTree", fsTree.toJSON());

  socket.on("fsTreeOperation", async(operation) => {
    console.log("Received FSTree operation from client:", operation);
    switch (operation.type) {
      case "mkdir":
        fsTree.mkdir(operation.path);
        break;
      case "rmdir":
        fsTree.rmdir(operation.path);
        break;
      case "mvdir":
        fsTree.mvdir(operation.oldPath, operation.newPath);
        break;
      case "append":
        fsTree.append(operation.dirent, operation.file);
        break;
      case "update":
        // For update, we need to pass a function. This might be tricky to serialize/deserialize.
        // For simplicity in this demo, we'll assume a direct update of properties.
        // A more robust solution would involve defining specific update operations.
        fsTree.update(operation.dirent, (file) => {
          return { ...file, ...operation.updates };
        });
        break;
      case "unlink":
        fsTree.unlink(operation.dirent);
        break;
      case "copy":
        fsTree.copy(operation.dirent, operation.newLocation);
        break;
      default:
        console.warn("Unknown FSTree operation type:", operation.type);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
