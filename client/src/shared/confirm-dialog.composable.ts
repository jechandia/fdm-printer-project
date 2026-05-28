import { reactive } from 'vue'

/**
 * Promise-based confirmation dialog, modeled after window.confirm() but
 * rendered inside the app's design system so destructive actions stop
 * popping up the OS prompt.
 *
 * Usage:
 *   const ok = await confirm({
 *     title: 'Cancel current print?',
 *     message: 'The print will stop and progress will be lost.',
 *     confirmText: 'Cancel print',
 *     severity: 'danger',
 *   })
 *   if (!ok) return
 *
 * The dialog is rendered exactly once by <ConfirmDialog /> mounted in
 * App.vue and driven from this module's reactive state.
 */

export type ConfirmSeverity = 'danger' | 'warning' | 'info'

export interface ConfirmOptions {
  title: string
  /** Body — string or array of paragraphs. */
  message: string | string[]
  /** Extra help text shown below the message in muted style. */
  hint?: string
  confirmText?: string
  cancelText?: string
  severity?: ConfirmSeverity
  /** Material icon name shown in the title row (defaults derived from severity). */
  icon?: string
}

interface ConfirmState {
  open: boolean
  options: Required<Omit<ConfirmOptions, 'message' | 'hint' | 'icon'>> & {
    message: string | string[]
    hint?: string
    icon?: string
  }
  resolve: (value: boolean) => void
}

const DEFAULTS: Required<Omit<ConfirmOptions, 'message' | 'hint' | 'icon'>> = {
  title: 'Are you sure?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  severity: 'warning',
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  options: { ...DEFAULTS, message: '' },
  resolve: () => {},
})

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmState.options = {
      ...DEFAULTS,
      ...options,
      // Make sure required defaults survive a partial options object.
      confirmText: options.confirmText ?? DEFAULTS.confirmText,
      cancelText: options.cancelText ?? DEFAULTS.cancelText,
      severity: options.severity ?? DEFAULTS.severity,
    }
    confirmState.resolve = resolve
    confirmState.open = true
  })
}

export function resolveConfirm(value: boolean): void {
  confirmState.resolve(value)
  confirmState.open = false
}

export function defaultIconFor(severity: ConfirmSeverity): string {
  if (severity === 'danger') return 'warning'
  if (severity === 'warning') return 'help_outline'
  return 'info'
}
