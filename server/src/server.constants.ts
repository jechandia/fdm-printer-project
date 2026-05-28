export const AppConstants = {
  NODE_ENV_KEY: "NODE_ENV",
  VERSION_KEY: "npm_package_version",
  SERVER_PORT_KEY: "SERVER_PORT",
  DATABASE_PATH: "DATABASE_PATH",
  defaultDatabasePath: "./database",
  DATABASE_FILE: "DATABASE_FILE",
  defaultDatabaseFile: "./prusahero.sqlite",

  pm2ServiceName: "PrusaHero",
  logAppName: "prusahero",

  MEDIA_PATH: "MEDIA_PATH",
  defaultBaseMediaPath: "./media",
  defaultLogsFolder: "logs",
  defaultLogZipsFolder: "log-zips",
  // New place for all downloads, files etc
  defaultClientBundleStorage: "client-dist",
  defaultClientBundleZipsStorage: "client-dist-zips",
  defaultPrinterThumbnailsStorage: "printer-thumbnails",
  defaultFileUploadsStorage: "file-uploads",
  defaultPrintFilesStorage: "files",
  defaultAcceptedGcodeExtensions: [".gcode", ".bgcode"],
  // 3MF is the PrusaSlicer / BambuStudio container format. Accepted by the
  // slicer-compat upload endpoint but not by PrusaLink printers directly.
  defaultAccepted3mfExtensions: [".3mf"],
  defaultServerPort: 4000,
  apiRoute: "/api/v2",
  enableClientDistAutoUpdateKey: "ENABLE_CLIENT_DIST_AUTO_UPDATE",

  // Boolean string (true/false), persisted always
  OVERRIDE_LOGIN_REQUIRED: "OVERRIDE_LOGIN_REQUIRED",
  // Boolean string (true/false), persisted always
  OVERRIDE_REGISTRATION_ENABLED: "OVERRIDE_REGISTRATION_ENABLED",
  // Number
  DEFAULT_USERNAME_MINLEN: 3,
  // Number
  DEFAULT_PASSWORD_MINLEN: 8,
  // String, persisted always
  OVERRIDE_JWT_SECRET: "OVERRIDE_JWT_SECRET",
  // Number, Seconds, persisted always
  OVERRIDE_JWT_EXPIRES_IN: "OVERRIDE_JWT_EXPIRES_IN",
  DEFAULT_JWT_EXPIRES_IN: 60 * 60, // 1 hour
  // Number
  DEFAULT_REFRESH_TOKEN_ATTEMPTS: -1, // 50 attempts, 50 hours
  // Number, Milli-seconds
  DEFAULT_REFRESH_TOKEN_EXPIRY: 60 * 60 * 24 * 14, // 14 days (in ms)
  // String, not persisted
  OVERRIDE_JWT_ISSUER: "OVERRIDE_JWT_ISSUER",
  DEFAULT_JWT_ISSUER: "prusahero-server",
  // String, not persisted
  OVERRIDE_JWT_AUDIENCE: "OVERRIDE_JWT_AUDIENCE",
  DEFAULT_JWT_AUDIENCE: "prusahero-client",

  OVERRIDE_IS_DEMO_MODE: "OVERRIDE_IS_DEMO_MODE",
  OVERRIDE_DEMO_USERNAME: "OVERRIDE_DEMO_USERNAME",
  DEFAULT_DEMO_USERNAME: "demo",
  OVERRIDE_DEMO_PASSWORD: "OVERRIDE_DEMO_PASSWORD",
  DEFAULT_DEMO_PASSWORD: "demo2023",
  OVERRIDE_DEMO_ROLE: "OVERRIDE_DEMO_ROLE",
  DEFAULT_DEMO_ROLE: "ADMIN",

  defaultDevelopmentEnv: "development",
  ENABLE_COLORED_LOGS_KEY: "ENABLE_COLORED_LOGS",
  defaultTestEnv: "test",
  defaultProductionEnv: "production",
  knownEnvNames: ["development", "production", "test"],
  GITHUB_PAT: "GITHUB_PAT",
  serverPackageName: "@prusahero/server",
  serverRepoName: "prusahero",
  clientPackageName: "@prusahero/client-next",
  clientRepoName: "prusahero",
  githubUrl: "https://github.com/jechandia/prusahero",
  docsUrl: "https://github.com/jechandia/prusahero",
  orgName: "prusahero",
  // Wizard version changes will trigger a re-run of the wizard
  currentWizardVersion: 1,
  defaultClientMinimum: "2.3.3",

  // Websocket values
  defaultWebsocketHandshakeTimeout: 3000,
  defaultSocketThrottleRate: 1,
  debugSocketStatesKey: "DEBUG_SOCKET_STATES",
  defaultDebugSocketStates: "false",

  // PrusaLink HTTP polling cadence (ms). Lower = fresher state but more load
  // on the Buddy board. Overridable via PRUSA_LINK_POLL_INTERVAL_MS env var
  // (clamped to [1000, 60000]).
  PRUSA_LINK_POLL_INTERVAL_MS: "PRUSA_LINK_POLL_INTERVAL_MS",
  defaultPrusaLinkPollIntervalMs: 5000,
  minPrusaLinkPollIntervalMs: 1000,
  maxPrusaLinkPollIntervalMs: 60_000,

  // Sentry
  sentryCustomDsnToken: "SENTRY_CUSTOM_DSN",
  sentryCustomDsnDefault:
    "https://164b8028a8a745bba3dbcab991b84ae7@o4503975545733120.ingest.sentry.io/4505101598261248",

  ENABLE_PROMETHEUS_METRICS: "ENABLE_PROMETHEUS_METRICS",
  ENABLE_LOKI_LOGGING: "ENABLE_LOKI_LOGGING",
  LOKI_ADDRESS: "LOKI_ADDRESS",
  LOKI_TIMEOUT_SECONDS: "LOKI_TIMEOUT_SECONDS",
  LOKI_INTERVAL: "LOKI_INTERVAL",

  // Swagger/OpenAPI Documentation
  DISABLE_SWAGGER_OPENAPI: "DISABLE_SWAGGER_OPENAPI",
  GENERATE_SWAGGER_JSON: "GENERATE_SWAGGER_JSON",
};
