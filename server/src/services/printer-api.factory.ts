import { type IPrinterApi } from "@/services/printer-api.interface";
import { DITokens } from "@/container.tokens";
import type { LoginDto } from "@/services/interfaces/login.dto";
import { PrinterCache } from "@/state/printer.cache";
import { CradleService } from "./core/cradle.service";

export class PrinterApiFactory {
  constructor(private readonly cradleService: CradleService) {}

  getById(id: number): IPrinterApi {
    const printerCache = this.cradleService.resolve<PrinterCache>(DITokens.printerCache);
    const login = printerCache.getLoginDto(id);
    return this.getScopedPrinter(login);
  }

  getScopedPrinter(login: LoginDto): IPrinterApi {
    const printerApi = this.cradleService.resolve<IPrinterApi>(DITokens.prusaLinkApi);
    printerApi.login = login;
    return printerApi;
  }
}
