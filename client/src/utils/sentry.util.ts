import * as Sentry from '@sentry/vue'

export function setSentryEnabled(enabled: boolean) {
  // Sentry init was stripped from this fork, so there's no client to configure.
  // Bail out instead of dereferencing undefined (which threw a TypeError during
  // app bootstrap and surfaced as a misleading "Error loading settings" toast).
  const client = Sentry.getClient()
  if (!client) return
  client.getOptions().enabled = enabled
  if (enabled) {
    console.warn('Sentry enabled:', enabled)
  }
}
