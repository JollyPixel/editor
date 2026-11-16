// Import Internal Dependencies
import { Username } from "../account/Username.ts";
import type { CredentialsBody } from "../http/routes.schema.ts";
import { prehashPassword } from "./prehashPassword.ts";

export async function credentialsBody(
  username: string,
  password: string
): Promise<CredentialsBody> {
  const parsed = Username.parse(username);

  return {
    username: parsed.value,
    password: await prehashPassword(parsed, password)
  };
}
