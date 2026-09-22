import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(here, "..");
export const jevModel = process.env.TYPESAFE_DEFAULT_MODEL || "jev-1.13.0";
export const defaultQuery = "repo decision harness GitNexus Jev";

export function requireApiKey() {
  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error("TYPESAFE_API_KEY is not set; Jev live verification cannot run.");
  }
}
