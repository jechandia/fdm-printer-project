import { asValue } from "awilix";
import { DITokens } from "@/container.tokens";
import type { NextFunction, Request, Response } from "express";
import { PrinterCache } from "@/state/printer.cache";
import { PrusaLinkApi } from "@/services/prusa-link/prusa-link.api";

export const printerIdToken = "currentPrinterId";
export const printerApiToken = "printerApi";
export const currentPrinterToken = "currentPrinter";
export const printerLoginToken = "printerLogin";

export const printerResolveMiddleware = (key = "id") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const printerCache = req.container.resolve<PrinterCache>(DITokens.printerCache);

    let scopedPrinter = undefined;
    let loginDto = undefined;

    const printerIdParam = req.params[key] as string;
    if (printerIdParam) {
      const printerId = Number.parseInt(printerIdParam, 10);
      scopedPrinter = printerCache.getCachedPrinterOrThrow(printerId);
      loginDto = printerCache.getLoginDto(printerId);

      const prusaLinkInstance = req.container.resolve<PrusaLinkApi>(DITokens.prusaLinkApi);
      req.container.register({
        [currentPrinterToken]: asValue(scopedPrinter),
        [printerLoginToken]: asValue(loginDto),
        [printerIdToken]: asValue(printerId),
        [printerApiToken]: asValue(prusaLinkInstance),
      });
    } else {
      req.container.register({
        [currentPrinterToken]: asValue(undefined),
        [printerLoginToken]: asValue(undefined),
        [printerIdToken]: asValue(undefined),
        [printerApiToken]: asValue(undefined),
      });
    }

    next();
  };
};
