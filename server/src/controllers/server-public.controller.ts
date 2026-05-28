import { before, GET, route } from "awilix-express";
import { AppConstants } from "@/server.constants";
import { isNode } from "@/utils/env.utils";
import { authenticate, permission } from "@/middleware/authenticate";
import { PERMS } from "@/constants/authorization.constants";
import { SettingsStore } from "@/state/settings.store";
import { ServerReleaseService } from "@/services/core/server-release.service";
import type { Request, Response } from "express";

@route(AppConstants.apiRoute)
export class ServerPublicController {
  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly serverVersion: string,
    private readonly serverReleaseService: ServerReleaseService,
  ) {}

  @GET()
  @route("/")
  @before([authenticate(), permission(PERMS.ServerInfo.Get)])
  async welcome(req: Request, res: Response) {
    this.settingsStore.getSettings();

    if (!(await this.settingsStore.getLoginRequired())) {
      return res.send({
        message: "Login disabled. Please load the Vue app.",
        apiDocs: "http://localhost:4000/api-docs/",
        swaggerJson: "http://localhost:4000/api-docs/swagger.json",
      });
    }

    return res.send({
      message: "Login required. Please load the Vue app.",
      apiDocs: "http://localhost:4000/api-docs/",
      swaggerJson: "http://localhost:4000/api-docs/swagger.json",
    });
  }

  @GET()
  @route("/features")
  @before([authenticate()])
  getFeatures(req: Request, res: Response) {
    res.send({
      multiplePrinterServices: {
        available: true,
        version: 1,
        subFeatures: {
          types: ["prusaLink"],
        },
      },
    });
  }

  @GET()
  @route("/version")
  @before([authenticate(), permission(PERMS.ServerInfo.Get)])
  async getVersion(req: Request, res: Response) {
    const updateState = this.serverReleaseService.getState();

    res.json({
      version: this.serverVersion,
      isNode: isNode(),
      os: process.env.OS,
      update: {
        synced: updateState.synced,
        updateAvailable: updateState.updateAvailable,
        airGapped: updateState.airGapped,
      },
    });
  }

  @GET()
  @route("/test")
  async test(req: Request, res: Response) {
    res.send({
      message: "Test successful. Please load the Vue app.",
    });
  }
}
