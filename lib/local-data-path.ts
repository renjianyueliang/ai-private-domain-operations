import path from "path";

export const LOCAL_DATA_DIR_ENV = "AI_PRIVATE_DOMAIN_LOCAL_DATA_DIR";

export function getLocalDataRoot() {
  const configuredRoot = process.env[LOCAL_DATA_DIR_ENV]?.trim();
  return configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(process.cwd(), ".local-data");
}
