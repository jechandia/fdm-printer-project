// Minimal stubs to keep PrinterEventsCache and TestPrinterSocketStore
// compiling after OctoPrint / Moonraker / Bambu adapter dirs were stripped.
// The cache and the test store both still hold vendor-specific branches
// (`onOctoPrintSocketMessage`, `onMoonrakerSocketMessage`, etc.) that no
// PrusaLink code path ever reaches — PR-4 deletes those branches along with
// this file. Until then, the stubs only need to satisfy the type checker.
//
// Nothing here is intended to be imported by new code.

export { WsMessage } from "@/shared/ws-message.constants";

export const messages = {
  connected: "connected",
  reauthRequired: "reauthRequired",
  current: "current",
  history: "history",
  event: "event",
  notify_status_update: "notify_status_update",
  WS_OPENED: "WS_OPENED",
  WS_CLOSED: "WS_CLOSED",
  WS_ERROR: "WS_ERROR",
  API_STATE_UPDATED: "API_STATE_UPDATED",
  WS_STATE_UPDATED: "WS_STATE_UPDATED",
} as const;

export const octoPrintEvent = (event: string) => `octoprint.${event}`;
export const moonrakerEvent = (event: string) => `moonraker.${event}`;
export const bambuEvent = (event: string) => `bambu.${event}`;

export interface OctoPrintEventDto<K = unknown, T = any> {
  event: K;
  payload: T;
  printerId: number;
  printerType: number;
}

export interface MoonrakerEventDto<K = unknown, T = any> {
  event: K;
  payload: T;
  printerId: number;
  printerType: number;
}

export interface BambuEventDto<K = unknown, T = any> {
  event: K;
  payload: T;
  printerId: number;
  printerType: number;
}

export interface CurrentMessageDto {
  [k: string]: any;
}

export type MR_WsMessage = string;
export type PrinterObjectsQueryDto<T = unknown> = Record<string, T>;
export type SubscriptionType = unknown;
