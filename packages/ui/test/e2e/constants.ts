// pixel-art holds 3000, and both dev servers may run at once.
export const PORT = 3001;
export const BASE_URL = `http://localhost:${PORT}`;

// The gallery is stateless, so workers can share one server.
export const WORKER_COUNT = 4;
