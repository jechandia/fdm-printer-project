import { onMounted, onUnmounted } from 'vue'
import type { EventBusKey } from '@vueuse/core'
import { useEventBus } from '@vueuse/core'

/**
 * Tiny event bus that broadcasts "the print-jobs list is now stale".
 *
 * The PrintJobs view loads via a plain `PrintJobService.searchJobsPaged`
 * call (not vue-query), so it can't auto-revalidate when state changes
 * elsewhere. Until that's refactored, any code that mutates a job —
 * pausing, resuming, stopping/cancelling, the socket-driven completion
 * watcher — calls `notifyPrintJobsChanged()` and the view re-fetches.
 *
 * Payload optionally carries the printerId so a future per-printer
 * filter can scope its refetch.
 */

export interface PrintJobsChangedEvent {
  printerId?: number
  /** Human-readable reason, mostly for debugging. */
  reason?: string
}

export const printJobsChangedKey: EventBusKey<PrintJobsChangedEvent> = Symbol(
  'print-jobs-changed',
)

/** Use from anywhere that mutates print-job state to fire the signal. */
export function notifyPrintJobsChanged(event: PrintJobsChangedEvent = {}): void {
  useEventBus(printJobsChangedKey).emit(event)
}

/**
 * Subscribe a callback to the signal. Auto-unsubscribes on unmount, so
 * it's safe to call from a component setup.
 */
export function useOnPrintJobsChanged(
  handler: (event: PrintJobsChangedEvent) => void | Promise<void>,
): void {
  const bus = useEventBus(printJobsChangedKey)
  const unsubscribe = bus.on(handler)
  onMounted(() => {
    /* no-op; subscription was set up at composable call time */
  })
  onUnmounted(() => {
    unsubscribe()
  })
}
