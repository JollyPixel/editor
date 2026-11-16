// Import Internal Dependencies
import type { Credentials } from "../AccountDirectory.ts";
import { Username } from "../account/Username.ts";
import type { CredentialsBody } from "../http/routes.schema.ts";
import { PasswordDigest } from "../session/PasswordDigest.ts";

export function parseCredentials(
  body: CredentialsBody
): Credentials {
  return {
    username: Username.parse(body.username),
    password: PasswordDigest.parse(body.password)
  };
}
