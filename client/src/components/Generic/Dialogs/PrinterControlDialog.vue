<template>
  <BaseDialog
    :id="dialog.dialogId"
    :max-width="'720px'"
    @escape="closeDialog()"
  >
    <v-card class="pc-dialog">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon size="small">open_with</v-icon>
        Printer Controls
        <v-spacer />
        <span v-if="printer" class="text-caption text-medium-emphasis">
          {{ printer.name }}
        </span>
        <v-btn icon="close" variant="text" size="small" @click="closeDialog()" />
      </v-card-title>

      <v-card-text v-if="printer">
        <!-- ── Temperatures ──────────────────────────────────── -->
        <div class="pc-temps mb-4">
          <div class="pc-temp">
            <v-icon size="small" class="mr-1" color="warning">device_thermostat</v-icon>
            <span class="text-caption">Tool</span>
            <strong class="ml-1">
              {{ toolTemp ? `${toolTemp.actual.toFixed(0)}°` : '—' }}
              <span v-if="toolTemp?.target" class="text-medium-emphasis">
                / {{ toolTemp.target.toFixed(0) }}°
              </span>
            </strong>
          </div>
          <div class="pc-temp">
            <v-icon size="small" class="mr-1" color="info">layers</v-icon>
            <span class="text-caption">Bed</span>
            <strong class="ml-1">
              {{ bedTemp ? `${bedTemp.actual.toFixed(0)}°` : '—' }}
              <span v-if="bedTemp?.target" class="text-medium-emphasis">
                / {{ bedTemp.target.toFixed(0) }}°
              </span>
            </strong>
          </div>
        </div>

        <!-- Manual movement isn't exposed by every printer firmware
             (PrusaLink HTTP and Bambu Lab MQTT reject jog/home). Show
             a brief note instead of letting the buttons 500. -->
        <v-alert
          v-if="!supportsMovement"
          type="info"
          variant="tonal"
          density="compact"
          icon="info"
          class="mb-4"
        >
          Manual movement (jog / home) isn't supported by this printer type.
          You can still tune feed and flow rate below.
        </v-alert>

        <!-- ── Movement controls ────────────────────────────── -->
        <div v-if="supportsMovement" class="pc-grid">
          <!-- X / Y joystick -->
          <div class="pc-axis">
            <div class="pc-axis__label">X / Y</div>
            <div class="pc-pad">
              <button class="pc-btn pc-btn--corner" @click="jog(-1, 1, 0)">
                <v-icon>north_west</v-icon>
              </button>
              <button class="pc-btn" @click="jog(0, 1, 0)">
                <v-icon>north</v-icon>
              </button>
              <button class="pc-btn pc-btn--corner" @click="jog(1, 1, 0)">
                <v-icon>north_east</v-icon>
              </button>

              <button class="pc-btn" @click="jog(-1, 0, 0)">
                <v-icon>west</v-icon>
              </button>
              <button class="pc-btn pc-btn--home" @click="home(['x', 'y'])">
                <v-icon>home</v-icon>
              </button>
              <button class="pc-btn" @click="jog(1, 0, 0)">
                <v-icon>east</v-icon>
              </button>

              <button class="pc-btn pc-btn--corner" @click="jog(-1, -1, 0)">
                <v-icon>south_west</v-icon>
              </button>
              <button class="pc-btn" @click="jog(0, -1, 0)">
                <v-icon>south</v-icon>
              </button>
              <button class="pc-btn pc-btn--corner" @click="jog(1, -1, 0)">
                <v-icon>south_east</v-icon>
              </button>
            </div>
          </div>

          <!-- Z axis -->
          <div class="pc-axis">
            <div class="pc-axis__label">Z</div>
            <div class="pc-z">
              <button class="pc-btn" @click="jog(0, 0, 1)">
                <v-icon>arrow_upward</v-icon>
              </button>
              <button class="pc-btn pc-btn--home" @click="home(['z'])">
                <v-icon>home</v-icon>
              </button>
              <button class="pc-btn" @click="jog(0, 0, -1)">
                <v-icon>arrow_downward</v-icon>
              </button>
            </div>
            <v-btn
              variant="text"
              size="x-small"
              prepend-icon="home"
              class="mt-2"
              @click="home(['x', 'y', 'z'])"
            >
              Home all
            </v-btn>
          </div>
        </div>

        <!-- ── Step selector ────────────────────────────────── -->
        <div v-if="supportsMovement" class="pc-section pc-step">
          <div class="pc-section__label">Step (mm)</div>
          <v-btn-toggle
            v-model="multiplier"
            color="primary"
            mandatory
            density="comfortable"
            divided
          >
            <v-btn :value="0.1" size="small">0.1</v-btn>
            <v-btn :value="1" size="small">1</v-btn>
            <v-btn :value="10" size="small">10</v-btn>
            <v-btn :value="100" size="small">100</v-btn>
          </v-btn-toggle>
        </div>

        <v-divider v-if="supportsMovement" class="my-4" />

        <!-- ── Feed rate / flow rate sliders ────────────────── -->
        <div class="pc-section">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-body-2 font-weight-medium d-flex align-center ga-1">
              <v-icon size="small">speed</v-icon>
              Feed rate
            </span>
            <v-chip size="x-small" variant="tonal" color="primary">
              {{ feedRate }}%
            </v-chip>
          </div>
          <v-slider
            v-model="feedRate"
            :min="10"
            :max="200"
            :step="5"
            density="compact"
            hide-details
            color="primary"
            :loading="settingFeedRate"
            @end="applyFeedRate"
          >
            <template #append>
              <v-btn
                size="x-small"
                variant="text"
                :disabled="feedRate === 100"
                @click="feedRate = 100; applyFeedRate()"
              >
                Reset
              </v-btn>
            </template>
          </v-slider>
        </div>

        <div class="pc-section mt-2">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-body-2 font-weight-medium d-flex align-center ga-1">
              <v-icon size="small">waterfall_chart</v-icon>
              Flow rate
            </span>
            <v-chip size="x-small" variant="tonal" color="primary">
              {{ flowRate }}%
            </v-chip>
          </div>
          <v-slider
            v-model="flowRate"
            :min="75"
            :max="125"
            :step="1"
            density="compact"
            hide-details
            color="primary"
            :loading="settingFlowRate"
            @end="applyFlowRate"
          >
            <template #append>
              <v-btn
                size="x-small"
                variant="text"
                :disabled="flowRate === 100"
                @click="flowRate = 100; applyFlowRate()"
              >
                Reset
              </v-btn>
            </template>
          </v-slider>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="closeDialog()">Close</v-btn>
      </v-card-actions>
    </v-card>
  </BaseDialog>
</template>

<script lang="ts" setup>
import { useDialog } from '@/shared/dialog.composable'
import { DialogName } from '@/components/Generic/Dialogs/dialog.constants'
import { computed, ref, watch } from 'vue'
import { usePrinterStore } from '@/store/printer.store'
import { usePrinterStateStore } from '@/store/printer-state.store'
import { PrintersService } from '@/backend'
import { useSnackbar } from '@/shared/snackbar.composable'
import { hasManualMovement } from '@/shared/printer-capabilities.constants'

const dialog = useDialog(DialogName.PrinterControlDialog)
const printerStore = usePrinterStore()
const printerStateStore = usePrinterStateStore()
const snackbar = useSnackbar()

const printerId = computed(() => dialog.context()?.printer?.id)
const printer = computed(() =>
  printerId.value ? printerStore.printer(printerId.value) : undefined
)

const multiplier = ref<number>(10)

const supportsMovement = computed(() =>
  printer.value ? hasManualMovement(printer.value.printerType) : false,
)
const feedRate = ref(100)
const flowRate = ref(100)
const settingFeedRate = ref(false)
const settingFlowRate = ref(false)

// Reset sliders when a new printer is opened.
watch(printerId, (id) => {
  if (id != null) {
    feedRate.value = 100
    flowRate.value = 100
  }
})

const latestTemps = computed(() => {
  if (!printerId.value) return null
  const events = printerStateStore.printerEventsById[printerId.value]
  const list = events?.current?.payload?.temps
  if (!list?.length) return null
  return list[list.length - 1]
})

const toolTemp = computed(() => latestTemps.value?.tool0 ?? null)
const bedTemp = computed(() => latestTemps.value?.bed ?? null)

async function jog(x: number, y: number, z: number) {
  if (!printerId.value) return
  try {
    await PrintersService.sendPrinterJogCommand(printerId.value, {
      x: x * multiplier.value,
      y: y * multiplier.value,
      z: z * multiplier.value
    })
  } catch (err: any) {
    snackbar.openErrorMessage({
      title: 'Jog failed',
      subtitle: err?.response?.data?.error || err?.message || ''
    })
  }
}

async function home(axes: string[]) {
  if (!printerId.value) return
  try {
    await PrintersService.sendPrinterHomeCommand(printerId.value, axes)
  } catch (err: any) {
    snackbar.openErrorMessage({
      title: 'Home failed',
      subtitle: err?.response?.data?.error || err?.message || ''
    })
  }
}

async function applyFeedRate() {
  if (!printerId.value) return
  settingFeedRate.value = true
  try {
    await PrintersService.setFeedRate(printerId.value, Math.round(feedRate.value))
  } catch (err: any) {
    snackbar.openErrorMessage({
      title: 'Failed to set feed rate',
      subtitle: err?.response?.data?.error || err?.message || ''
    })
  } finally {
    settingFeedRate.value = false
  }
}

async function applyFlowRate() {
  if (!printerId.value) return
  settingFlowRate.value = true
  try {
    await PrintersService.setFlowRate(printerId.value, Math.round(flowRate.value))
  } catch (err: any) {
    snackbar.openErrorMessage({
      title: 'Failed to set flow rate',
      subtitle: err?.response?.data?.error || err?.message || ''
    })
  } finally {
    settingFlowRate.value = false
  }
}

function closeDialog() {
  dialog.closeDialog()
}
</script>

<style scoped>
.pc-dialog {
  background: rgb(var(--v-theme-surface));
}

/* ─── Temperatures strip ─────────────────────────────────────── */
.pc-temps {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pc-temp {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

/* ─── Movement grid ──────────────────────────────────────────── */
.pc-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  align-items: start;
}

.pc-axis__label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-bottom: 6px;
  text-align: center;
}

.pc-pad {
  display: grid;
  grid-template-columns: repeat(3, 56px);
  grid-template-rows: repeat(3, 56px);
  gap: 6px;
}

.pc-z {
  display: grid;
  grid-template-columns: 56px;
  grid-template-rows: repeat(3, 56px);
  gap: 6px;
  justify-content: center;
}

.pc-btn {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-theme-primary), 0.45);
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.12s ease, transform 0.06s ease;
}

.pc-btn:hover {
  background: rgba(var(--v-theme-primary), 0.18);
}

.pc-btn:active {
  transform: scale(0.96);
}

.pc-btn--corner {
  border-color: rgba(var(--v-theme-primary), 0.25);
  background: transparent;
}

.pc-btn--home {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-color: rgba(var(--v-theme-on-surface), 0.2);
  color: rgba(var(--v-theme-on-surface), 0.85);
}

.pc-btn--home:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
}

/* ─── Step + sections ────────────────────────────────────────── */
.pc-section {
  margin-top: 16px;
}

.pc-section__label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-bottom: 6px;
}

.pc-step {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pc-step .pc-section__label {
  margin-bottom: 0;
}
</style>
