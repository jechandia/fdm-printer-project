// Generic socket lifecycle event names. Used by every websocket-style adapter
// (and the PrusaLink HTTP poller, which fakes a socket lifecycle on top of
// polling) to emit state-change notifications.
export const WsMessage = {
  WS_OPENED: "WS_OPENED",
  WS_CLOSED: "WS_CLOSED",
  WS_ERROR: "WS_ERROR",
  API_STATE_UPDATED: "API_STATE_UPDATED",
  WS_STATE_UPDATED: "WS_STATE_UPDATED",
} as const;
export type WsMessage = keyof typeof WsMessage;
