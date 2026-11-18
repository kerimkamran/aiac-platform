import "server-only";
import { timingSafeEqual } from "node:crypto";

/** True when the request carries "Authorization: Bearer <CRON_SECRET>". The comparison takes the
 *  same time whatever part of the secret is right, and an unset secret never matches. */
export function isCronAuthorized(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorizationHeader) return false;
  const given = Buffer.from(authorizationHeader);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
