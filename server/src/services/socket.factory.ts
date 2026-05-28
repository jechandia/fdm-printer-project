import { DITokens } from "@/container.tokens";
import type { IWebsocketAdapter } from "@/services/websocket-adapter.interface";
import { CradleService } from "@/services/core/cradle.service";

export class SocketFactory {
  constructor(private readonly cradleService: CradleService) {}

  createInstance(_printerType: number): IWebsocketAdapter {
    return this.cradleService.resolve(DITokens.prusaLinkPollingAdapter);
  }
}
