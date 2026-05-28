import { readFileSync } from "node:fs";
import { AppConstants } from "./server.constants";
import { LoggerService as Logger } from "./handlers/logger";
import { errorSummary } from "./utils/error.utils";
import { packageJsonPath } from "@/utils/fs.utils";
import { collectDefaultMetrics, register } from "prom-client";

export function setupEnvConfig() {
  const logger = new Logger("FDM-Environment");
  const environment = process.env[AppConstants.NODE_ENV_KEY];
  if (!environment || !AppConstants.knownEnvNames.includes(environment)) {
    const newEnvName = AppConstants.defaultProductionEnv;
    process.env[AppConstants.NODE_ENV_KEY] = newEnvName;
    logger.warn(`NODE_ENV=${environment} was not set, or not known. Defaulting to NODE_ENV=${newEnvName}`);
  } else {
    logger.log(`✓ NODE_ENV variable correctly set (${environment})`);
  }

  ensurePackageVersionSet();
  installUnhandledRejectionHandler();
  ensurePortSet();

  // Optional: Enable collection of default metrics like memory, CPU, etc.
  if (process.env[AppConstants.ENABLE_PROMETHEUS_METRICS] === "true") {
    collectDefaultMetrics({ register });
    register.removeSingleMetric("nodejs_version_info");
  }
}

function ensurePackageVersionSet() {
  const logger = new Logger("FDM-Environment");
  const packageJson = JSON.parse(readFileSync(packageJsonPath(), "utf-8"));
  const packageJsonVersion = packageJson.version;
  process.env[AppConstants.VERSION_KEY] ??= packageJsonVersion;

  logger.log(`✓ Running server version ${process.env[AppConstants.VERSION_KEY]}`);
}

export function fetchServerPort() {
  let port = process.env[AppConstants.SERVER_PORT_KEY];
  if (Number.isNaN(Number.parseInt(port!))) {
    // Update config immediately
    process.env[AppConstants.SERVER_PORT_KEY] = AppConstants.defaultServerPort.toString();
    port = process.env[AppConstants.SERVER_PORT_KEY];
  }
  return port;
}

function installUnhandledRejectionHandler() {
  const logger = new Logger("FDM-Environment");
  process.on("unhandledRejection", (e) => {
    // Server must not crash on unhandled rejections — log and continue.
    logger.error(`Unhandled rejection error - ${errorSummary(e)}`);
  });
}

export function ensurePortSet() {
  const logger = new Logger("FDM-Environment");
  fetchServerPort();

  if (!process.env[AppConstants.SERVER_PORT_KEY]) {
    logger.log(`~ ${AppConstants.SERVER_PORT_KEY} environment variable is not set`);
    logger.log(`Please make sure to read ${AppConstants.docsUrl} for more information.`);
    process.env[AppConstants.SERVER_PORT_KEY] = AppConstants.defaultServerPort.toString();
  }
}
