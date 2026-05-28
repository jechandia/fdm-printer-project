import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePrinterStateStore } from '@/store/printer-state.store'
import { usePrinterStore } from '@/store/printer.store'
import { useSnackbar } from '@/shared/snackbar.composable'
import { derivePrinterAttention, type PrinterAttention } from '@/shared/printer-attention.util'
import { notifyPrintJobsChanged } from '@/shared/print-jobs-invalidator.composable'

interface PrinterPrintSnapshot {
  printing: boolean
  fileName: string | undefined
  flagsKey: string
  attentionKind: PrinterAttention['kind'] | null
}

/**
 * Background watcher that turns socket-driven state transitions into a
 * "print finished / failed" toast so the user doesn't have to babysit the
 * grid to know when a job ended.
 *
 * Strategy: keep a per-printer snapshot of the relevant flags + currently
 * printing file. Whenever the socket pushes a new event, compare against
 * the snapshot and emit a snackbar on completion / failure transitions.
 *
 * Mount once at the app level (App.vue) — it self-cleans via the watcher.
 */
export function usePrintCompletionWatcher() {
  const printerStateStore = usePrinterStateStore()
  const printerStore = usePrinterStore()
  const snackbar = useSnackbar()

  const { printerEventsById, printingFilePathsByPrinterId, socketStatesById } =
    storeToRefs(printerStateStore)

  const snapshots = new Map<number, PrinterPrintSnapshot>()
  // Avoid firing on the very first tick after mount — we don't have a
  // previous state to compare against, so transitions on bootstrap would
  // be noise.
  let primed = false

  function buildSnapshot(printerId: number): PrinterPrintSnapshot {
    const events = printerEventsById.value?.[printerId]
    const flags = events?.current?.payload?.state?.flags ?? {}
    const printer = printerStore.printer(printerId)
    const attention = derivePrinterAttention(
      printer,
      events,
      socketStatesById.value?.[printerId],
    )
    return {
      printing: !!(flags.printing || flags.paused || flags.pausing),
      fileName: printingFilePathsByPrinterId.value?.[printerId],
      flagsKey: [
        flags.printing ? 'P' : '',
        flags.paused ? 'p' : '',
        flags.error ? 'E' : '',
        flags.operational ? 'O' : '',
        flags.cancelling ? 'C' : '',
      ].join(''),
      attentionKind: attention.needsAttention ? attention.kind : null,
    }
  }

  /**
   * Attention kinds worth a transient toast on first entry. Skips the
   * transient/expected ones (paused, busy, cancelling, transferring,
   * hot-idle) so the user doesn't get spammed during normal operation.
   */
  const ALERT_KINDS = new Set<PrinterAttention['kind']>([
    'attention',
    'error',
    'auth-failure',
    'disconnected',
    'offline',
    'low-storage',
  ])

  function describeTransition(
    prev: PrinterPrintSnapshot,
    next: PrinterPrintSnapshot,
    events: any,
  ): { kind: 'completed' | 'failed' | 'cancelled'; reason?: string } | null {
    // Only report when we *leave* a printing state.
    if (!prev.printing || next.printing) return null

    const flags = events?.current?.payload?.state?.flags ?? {}
    const text: string = events?.current?.payload?.state?.text ?? ''
    const lower = text.toLowerCase()

    if (flags.error || lower.includes('error') || lower.includes('fail')) {
      return { kind: 'failed', reason: text || 'Print failed' }
    }
    if (lower.includes('cancel')) {
      return { kind: 'cancelled', reason: text || 'Print cancelled' }
    }
    // Default: finished cleanly. Many firmwares go straight to "Operational"
    // after a successful run, so treat the leave-while-not-error path as
    // completion.
    return { kind: 'completed' }
  }

  watch(
    printerEventsById,
    () => {
      const ids = Object.keys(printerEventsById.value ?? {}).map(Number)
      for (const id of ids) {
        const next = buildSnapshot(id)
        const prev = snapshots.get(id)

        if (prev && primed) {
          // Any change in the printing/paused/error/cancelling flag set
          // means the backing PrintJob row in the DB just changed status.
          // Tell open list views (PrintJobs / queue) to refetch instead
          // of polling for changes that originated here.
          if (prev.flagsKey !== next.flagsKey) {
            notifyPrintJobsChanged({ printerId: id, reason: 'flags-change' })
          }

          // ── Print finished / failed / cancelled ──
          const transition = describeTransition(prev, next, printerEventsById.value?.[id])
          if (transition) {
            const printer = printerStore.printer(id)
            const printerName = printer?.name ?? `Printer #${id}`
            const fileName = prev.fileName ?? '(unknown file)'

            if (transition.kind === 'completed') {
              snackbar.openInfoMessage({
                title: `${printerName} finished print`,
                subtitle: fileName,
              })
            } else if (transition.kind === 'failed') {
              snackbar.openErrorMessage({
                title: `${printerName} — print failed`,
                subtitle: transition.reason ?? fileName,
              })
            } else if (transition.kind === 'cancelled') {
              snackbar.openInfoMessage({
                title: `${printerName} — print cancelled`,
                subtitle: fileName,
              })
            }
          }

          // ── Attention entry (ATTENTION / error / auth fail / offline) ──
          // Fire only on the *entry* into a new attention kind so we don't
          // spam toasts every socket tick while the condition persists.
          if (
            next.attentionKind !== prev.attentionKind &&
            next.attentionKind &&
            ALERT_KINDS.has(next.attentionKind)
          ) {
            const printer = printerStore.printer(id)
            const printerName = printer?.name ?? `Printer #${id}`
            const attention = derivePrinterAttention(
              printer,
              printerEventsById.value?.[id],
              socketStatesById.value?.[id],
            )

            const emit =
              attention.severity === 'critical'
                ? snackbar.openErrorMessage
                : snackbar.openInfoMessage
            emit({
              title: `${printerName} — ${attention.title}`,
              subtitle: attention.message,
            })
          }
        }

        snapshots.set(id, next)
      }
      primed = true
    },
    { deep: true, immediate: true },
  )
}
