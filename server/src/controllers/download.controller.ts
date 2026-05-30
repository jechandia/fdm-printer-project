import { GET, route } from "awilix-express";
import { AppConstants } from "@/server.constants";
import type { Request, Response } from "express";
import { FileStorageService } from "@/services/file-storage.service";
import { DownloadTicketService } from "@/services/download-ticket.service";
import type { ILoggerFactory } from "@/handlers/logger-factory";
import { LoggerService } from "@/handlers/logger";

/**
 * Public, ticket-gated file downloads. Unlike FileStorageController this has
 * NO authenticate() guard — that's the whole point: a `<a download>` link
 * can't carry a Bearer header, so access is granted by a short-lived,
 * single-use ticket minted elsewhere (FileStorageController) by an
 * authenticated user. The ticket is the only credential, consumed on redeem.
 */
@route(AppConstants.apiRoute + "/download")
export class DownloadController {
  private readonly logger: LoggerService;

  constructor(
    loggerFactory: ILoggerFactory,
    private readonly fileStorageService: FileStorageService,
    private readonly downloadTicketService: DownloadTicketService,
  ) {
    this.logger = loggerFactory(DownloadController.name);
  }

  /**
   * Redeem a one-time ticket and stream the file. GET so it works as a plain
   * browser navigation / `<a download>` (native, parallel, survives leaving
   * the SPA page).
   * GET /api/download/redeem?ticket=…
   */
  @GET()
  @route("/redeem")
  async redeem(req: Request, res: Response) {
    const ticket = typeof req.query.ticket === "string" ? req.query.ticket : "";
    if (!ticket) {
      res.status(400).send({ error: "Missing ticket" });
      return;
    }

    const fileStorageId = this.downloadTicketService.redeem(ticket);
    if (!fileStorageId) {
      res.status(403).send({ error: "Invalid or expired download ticket" });
      return;
    }

    await this.fileStorageService.streamDownload(res, fileStorageId);
  }
}
