import { KeyDiffCache } from "@/utils/cache/key-diff.cache";
import { printerEvents, PrintersDeletedEvent } from "@/constants/event.constants";
import EventEmitter2 from "eventemitter2";
import { prusaLinkEvent } from "@/services/prusa-link/constants/prusalink.constants";
import type { PrusaLinkEventDto } from "@/services/prusa-link/constants/prusalink-event.dto";
import type { ILoggerFactory } from "@/handlers/logger-factory";
import { LoggerService } from "@/handlers/logger";
import { PrintJobService } from "@/services/orm/print-job.service";
import { PrinterCache } from "@/state/printer.cache";
import { PrinterThumbnailCache } from "@/state/printer-thumbnail.cache";

// Cache record shape. The string-union keys are what the Socket.IO gateway
// fans out to the client, so they have to stay stable even when only a few
// of them ever get written. The historical octoprint/moonraker/bambu-only
// keys (`connected`, `reauthRequired`, `notify_status_update`, `history`)
// are kept as null slots so the wire format the frontend reads doesn't
// change.
export type PrinterEventsCacheKey =
  | "connected"
  | "reauthRequired"
  | "notify_status_update"
  | "current"
  | "history"
  | "API_STATE_UPDATED"
  | "WS_CLOSED"
  | "WS_ERROR"
  | "WS_OPENED"
  | "WS_STATE_UPDATED";
export type PrinterEventsCacheDto = Record<PrinterEventsCacheKey, any>;

export class PrinterEventsCache extends KeyDiffCache<PrinterEventsCacheDto> {
  private readonly logger: LoggerService;

  constructor(
    private readonly eventEmitter2: EventEmitter2,
    loggerFactory: ILoggerFactory,
    private readonly printJobService: PrintJobService,
    private readonly printerCache: PrinterCache,
    private readonly printerThumbnailCache: PrinterThumbnailCache,
  ) {
    super();

    this.logger = loggerFactory(PrinterEventsCache.name);
    this.subscribeToEvents();
  }

  async deletePrinterSocketEvents(id: number) {
    await this.deleteKeyValue(id, true);
  }

  async getPrinterSocketEvents(id: number) {
    return this.keyValueStore.get(id);
  }

  async getOrCreateEvents(printerId: number) {
    let ref = await this.getValue(printerId);
    if (!ref) {
      ref = {
        connected: null,
        reauthRequired: null,
        notify_status_update: null,
        current: null,
        history: null,
        API_STATE_UPDATED: null,
        WS_CLOSED: null,
        WS_ERROR: null,
        WS_OPENED: null,
        WS_STATE_UPDATED: null,
      };
      await this.setKeyValue(printerId, ref);
    }
    return ref;
  }

  async setEvent(printerId: number, label: PrinterEventsCacheKey, payload: any) {
    const ref = await this.getOrCreateEvents(printerId);
    ref[label] = {
      payload,
      receivedAt: Date.now(),
    };
    await this.setKeyValue(printerId, ref);
  }

  private async handlePrintersDeleted(event: PrintersDeletedEvent) {
    await this.deleteKeysBatch(event.printerIds);
  }

  private subscribeToEvents() {
    this.eventEmitter2.on(prusaLinkEvent("*"), (e) => this.onPrusaLinkPollMessage(e));
    this.eventEmitter2.on(printerEvents.printersDeleted, this.handlePrintersDeleted.bind(this));
  }

  private async getPrinterName(printerId: number): Promise<string | undefined> {
    try {
      const printer = await this.printerCache.getValue(printerId);
      return printer?.name;
    } catch (error) {
      this.logger.debug(`Could not get printer name for ${printerId}: ${error}`);
      return undefined;
    }
  }

  private async onPrusaLinkPollMessage(e: PrusaLinkEventDto) {
    const printerId = e.printerId;
    if (e.event !== "current") return;

    await this.setEvent(printerId, "current", e.payload);
    const payload = e.payload as any;
    // `state` is an object ({ text, flags, error }) — the adapter writes
    // the raw PrusaLink link_state ("PRINTING", "FINISHED", "STOPPED",
    // "ERROR", "READY"…) into `state.text` and mirrors it into flags.
    // Comparing the whole object to a string silently missed every
    // completion/failure transition before this was rewritten.
    const stateText: string | undefined = payload?.state?.text;
    const stateUpper = stateText?.toUpperCase() ?? "";
    const flags = payload?.state?.flags;
    // Prefer the long display name over the firmware's short DOS-style
    // path so the PrintJob row gets stored as "WIRBEL_TESTPART.BGC"
    // instead of the unfriendly "/usb/PRODUK~1/.../WIRBEL~1/3XAT9_~1.BGC"
    // that Buddy returns in `file.path`. All subsequent
    // markStarted / markProgress / markFinished calls in this handler
    // use the same `filename`, so they stay consistent.
    const filename = payload?.job?.file?.display ?? payload?.job?.file?.name ?? payload?.job?.file?.path;
    const completion = payload?.progress?.completion;
    if (stateUpper === "PRINTING" && filename) {
      const printerName = await this.getPrinterName(printerId);
      const job = await this.printJobService.markStarted(printerId, filename, printerName);

      if (job) {
        await this.printerThumbnailCache.handleJobStarted(printerId, job.id);
      }

      if (job && !job.fileStorageId && job.analysisState === "NOT_ANALYZED") {
        this.logger.log(`Job ${job.id} has no local file - triggering download and analysis`);
        await this.printJobService.triggerFileAnalysis(job.id);
      }
    }
    if (typeof completion === "number" && filename) {
      await this.printJobService.markProgress(printerId, filename, completion);
    }
    // PrusaLink terminal states. ATTENTION is purposefully excluded —
    // it's a transient hold, not a job ending. ERROR and STOPPED end
    // the job as failed; FINISHED ends it as completed.
    if (stateUpper === "FINISHED" && filename) {
      const job = await this.printJobService.markFinished(printerId, filename);
      if (job) {
        await this.printerThumbnailCache.handleJobCompleted(printerId, job.id);
      }
    } else if ((stateUpper === "STOPPED" || stateUpper === "CANCELLING" || flags?.cancelling) && filename) {
      // STOPPED is PrusaLink's "user cancelled" terminal state. Match
      // the controller's cancel path so the job ends up as CANCELLED
      // instead of FAILED.
      await this.printJobService.handlePrintCancelled(printerId, stateText ?? "Cancelled");
    } else if ((stateUpper === "ERROR" || flags?.error) && !stateUpper.startsWith("ATTENTION") && filename) {
      await this.printJobService.markFailed(printerId, filename, stateText ?? "Error");
    }
  }
}
