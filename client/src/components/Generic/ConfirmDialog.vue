<template>
  <v-dialog
    :model-value="confirmState.open"
    max-width="460"
    persistent
    @keydown.esc="cancel"
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2 text-subtitle-1">
        <v-icon :color="severityColor">{{ resolvedIcon }}</v-icon>
        {{ confirmState.options.title }}
      </v-card-title>

      <v-card-text class="confirm-dialog__body">
        <template v-if="isArrayMessage">
          <p
            v-for="(p, i) in (confirmState.options.message as string[])"
            :key="i"
            class="text-body-2 mb-2"
          >
            {{ p }}
          </p>
        </template>
        <p v-else class="text-body-2">
          {{ confirmState.options.message }}
        </p>
        <p
          v-if="confirmState.options.hint"
          class="text-caption text-medium-emphasis mt-2"
        >
          {{ confirmState.options.hint }}
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="cancel"
        >
          {{ confirmState.options.cancelText }}
        </v-btn>
        <v-btn
          :color="severityColor"
          variant="flat"
          @click="confirm"
        >
          {{ confirmState.options.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { confirmState, resolveConfirm, defaultIconFor } from '@/shared/confirm-dialog.composable'

const severityColor = computed(() => {
  switch (confirmState.options.severity) {
    case 'danger':
      return 'error'
    case 'warning':
      return 'warning'
    default:
      return 'primary'
  }
})

const resolvedIcon = computed(
  () => confirmState.options.icon ?? defaultIconFor(confirmState.options.severity),
)

const isArrayMessage = computed(() => Array.isArray(confirmState.options.message))

function cancel() {
  resolveConfirm(false)
}

function confirm() {
  resolveConfirm(true)
}
</script>

<style scoped>
.confirm-dialog__body {
  padding-top: 8px;
  padding-bottom: 0;
}
</style>
