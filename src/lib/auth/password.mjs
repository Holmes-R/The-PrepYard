import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}
export function validPassword(value) {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}
export async function hashPassword(password) {
  if (!validPassword(password))
    throw new Error("Use 12–128 characters for your PrepYard password.");
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, options);
  return "scrypt$" + salt + "$" + key.toString("hex");
}
const dummy = "scrypt$" + "0".repeat(32) + "$" + "0".repeat(128);
export async function verifyPassword(password, stored) {
  if (!validPassword(password)) return false;
  const encoded =
    typeof stored === "string" &&
    /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(stored)
      ? stored
      : dummy;
  const [, salt, expected] = encoded.split("$");
  const actual = await scrypt(password, salt, 64, options);
  return (
    timingSafeEqual(actual, Buffer.from(expected, "hex")) && encoded !== dummy
  );
}
export function tokenDigest(value) {
  return createHash("sha256").update(value).digest("hex");
}
export function newEmailToken() {
  const token = randomBytes(32).toString("hex");
  return { token, digest: tokenDigest(token) };
}
export function validEmailToken(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
