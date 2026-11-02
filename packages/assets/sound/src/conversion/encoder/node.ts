let registration: Promise<void> | null = null;

export function registerOpusEncoder(): Promise<void> {
  registration ??= import("@mediabunny/server").then((server) => {
    server.registerMediabunnyServer();
  });

  return registration;
}
