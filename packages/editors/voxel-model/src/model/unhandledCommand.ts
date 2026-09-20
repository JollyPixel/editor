export function unhandledCommand(
  scope: string,
  command: never
): Error {
  return new Error(
    `${scope}: unhandled command ${JSON.stringify(command)}.`
  );
}
