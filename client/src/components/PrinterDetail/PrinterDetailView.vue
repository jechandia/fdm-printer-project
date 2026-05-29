<template>
  <div v-if="!printer" class="pdv-missing">
    <v-icon size="64" color="medium-emphasis">help_outline</v-icon>
    <h2 class="text-h6 mt-2">Printer not found</h2>
    <p class="text-body-2 text-medium-emphasis">No printer with id {{ printerId }}.</p>
    <v-btn class="mt-3" color="primary" variant="tonal" to="/printer-grid">
      Back to grid
    </v-btn>
  </div>

  <div v-else class="pdv">
    <!-- Top header: identity + live state + back/refresh -->
    <div class="pdv-header">
      <v-btn
        icon="arrow_back"
        variant="text"
        size="small"
        @click="router.back()"
      />
      <h2 class="pdv-title text-h6 ml-2">{{ printer.name }}</h2>
      <v-chip
        :color="stateChipColor"
        size="small"
        variant="elevated"
        density="comfortable"
        class="ml-3"
      >
        {{ stateChipText }}
      </v-chip>
      <v-chip
        v-if="firmwareMessage"
        size="x-small"
        variant="tonal"
        color="grey-darken-2"
        density="comfortable"
        class="ml-2 pdv-fw-msg"
        :title="firmwareMessage"
      >
        <v-icon size="12" start>chat</v-icon>
        {{ firmwareMessage }}
      </v-chip>
      <v-spacer />
      <v-btn
        :disabled="!isOnline"
        variant="text"
        size="small"
        prepend-icon="open_with"
        @click="openControlDialog"
      >
        Jog &amp; home
      </v-btn>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="open_in_new"
        :href="printer.printerURL"
        target="_blank"
        rel="noopener"
        class="ml-1"
      >
        Open PrusaLink
      </v-btn>
      <v-btn
        v-if="!printer.enabled"
        variant="tonal"
        size="small"
        color="warning"
        prepend-icon="construction"
        class="ml-2"
        disabled
      >
        Under maintenance
      </v-btn>
    </div>

    <v-tabs v-model="tab" class="pdv-tabs">
      <v-tab value="overview">Overview</v-tab>
      <v-tab value="files">Files</v-tab>
      <v-tab value="history">History</v-tab>
      <v-tab value="maintenance">Maintenance</v-tab>
      <v-tab value="settings">Settings</v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab" class="pdv-window">
      <!-- ========== OVERVIEW ========== -->
      <v-tabs-window-item value="overview">
        <v-row dense class="pa-3">
          <v-col cols="12" md="7">
            <!-- Current print card -->
            <v-card class="pdv-card" variant="tonal">
              <v-card-title class="text-subtitle-1">
                <v-icon class="mr-2" color="primary">play_arrow</v-icon>
                Current print
              </v-card-title>
              <v-divider />
              <v-card-text>
                <div v-if="!currentJob" class="pdv-empty">
                  <v-icon size="48" color="medium-emphasis">pause_circle</v-icon>
                  <p class="text-body-2 text-medium-emphasis mt-2">
                    No active print.
                  </p>
                </div>
                <div v-else class="pdv-current">
                  <div class="pdv-current__thumb">
                    <v-img
                      v-if="thumbnail"
                      :src="'data:image/png;base64,' + thumbnail"
                      max-height="200"
                      contain
                    />
                    <v-icon v-else size="80" color="medium-emphasis">image</v-icon>
                  </div>
                  <div class="pdv-current__info">
                    <div class="text-body-1 text-truncate" :title="currentFileName ?? ''">
                      {{ currentFileName ?? '—' }}
                    </div>
                    <v-progress-linear
                      :model-value="(currentJob.progress?.completion ?? 0)"
                      :indeterminate="!currentJob.progress?.completion"
                      :color="isPaused ? 'warning' : 'success'"
                      height="6"
                      rounded
                      class="mt-2"
                    />
                    <div class="d-flex align-center mt-1">
                      <span class="text-h6">{{ progressPercent }}%</span>
                      <span v-if="timeRemainingFormatted" class="text-body-2 ml-2">
                        · {{ timeRemainingFormatted }}
                      </span>
                      <span v-if="etaClockFormatted" class="text-body-2 text-medium-emphasis ml-1">
                        · done {{ etaClockFormatted }}
                      </span>
                    </div>
                    <div class="d-flex mt-3 pdv-temps">
                      <span v-if="toolTempStr" class="mr-3" title="Tool">
                        🔥 {{ toolTempStr }}
                      </span>
                      <span v-if="bedTempStr" title="Bed">
                        🛏 {{ bedTempStr }}
                      </span>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="5">
            <!-- Queue card -->
            <v-card class="pdv-card" variant="tonal">
              <v-card-title class="text-subtitle-1 d-flex align-center">
                <v-icon class="mr-2" color="primary">queue</v-icon>
                Queue
                <v-chip
                  v-if="queue.length > 0"
                  size="x-small"
                  variant="tonal"
                  density="comfortable"
                  class="ml-2"
                >
                  {{ queue.length }}
                </v-chip>
              </v-card-title>
              <v-divider />
              <v-card-text>
                <div v-if="queueLoading" class="text-center">
                  <v-progress-circular indeterminate size="20" width="2" />
                </div>
                <div v-else-if="queue.length === 0" class="pdv-empty">
                  <p class="text-body-2 text-medium-emphasis">Queue is empty.</p>
                </div>
                <ol v-else class="pdv-queue-list">
                  <li
                    v-for="job in queue"
                    :key="job.id"
                    class="pdv-queue-row"
                    :class="{ 'pdv-queue-row--starting': job.status === 'STARTING' }"
                  >
                    <span class="pdv-queue-row__pos">
                      {{ job.queuePosition + 1 }}.
                    </span>
                    <span
                      class="pdv-queue-row__name text-truncate"
                      :title="job.fileName"
                    >
                      {{ job.fileName }}
                    </span>
                    <v-chip
                      v-if="job.status === 'STARTING'"
                      size="x-small"
                      color="primary"
                      variant="tonal"
                      density="comfortable"
                    >
                      Transferring…
                    </v-chip>
                  </li>
                </ol>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-tabs-window-item>

      <!-- ========== FILES ========== -->
      <v-tabs-window-item value="files">
        <div class="pa-3">
          <div class="d-flex align-center mb-2">
            <v-btn-toggle
              v-model="filesSource"
              density="comfortable"
              color="primary"
              mandatory
              variant="outlined"
            >
              <v-btn size="small" value="usb">Printer USB</v-btn>
              <v-btn size="small" value="storage">File storage</v-btn>
            </v-btn-toggle>
            <span
              v-if="filesBreadcrumb.length > 0"
              class="ml-3 text-body-2 text-medium-emphasis"
            >
              <a href="#" class="pdv-crumb" @click.prevent="navigateFilesTo('')">root</a>
              <template v-for="(seg, i) in filesBreadcrumb" :key="i">
                /
                <a
                  href="#"
                  class="pdv-crumb"
                  @click.prevent="navigateFilesTo(filesBreadcrumb.slice(0, i + 1).join('/'))"
                >{{ seg }}</a>
              </template>
            </span>
            <v-spacer />
            <v-btn
              size="small"
              variant="text"
              prepend-icon="folder_open"
              @click="openSideNavExplorer"
            >
              Full file browser
            </v-btn>
          </div>

          <div v-if="filesLoading" class="pdv-empty">
            <v-progress-circular indeterminate size="20" width="2" />
          </div>
          <div
            v-else-if="!filesData || (filesData.dirs.length === 0 && filesData.files.length === 0)"
            class="pdv-empty"
          >
            <v-icon size="48" color="medium-emphasis">folder_off</v-icon>
            <p class="text-body-2 text-medium-emphasis mt-2">No files here.</p>
            <v-btn
              v-if="filesPath"
              size="small"
              variant="text"
              class="mt-2"
              @click="navigateFilesTo(parentPathOf(filesPath))"
            >
              ↑ Up one level
            </v-btn>
          </div>
          <v-list v-else density="comfortable" class="pdv-files">
            <v-list-item
              v-if="filesPath"
              prepend-icon="arrow_upward"
              title=".."
              @click="navigateFilesTo(parentPathOf(filesPath))"
            />
            <v-list-item
              v-for="d in filesData.dirs"
              :key="`d:${d.path}`"
              prepend-icon="folder"
              :title="leafName(d.path)"
              @click="navigateFilesTo(d.path)"
            />
            <v-list-item
              v-for="f in filesData.files"
              :key="`f:${f.path}`"
              prepend-icon="insert_drive_file"
              :title="leafName(f.path)"
              :subtitle="fileSubtitle(f)"
            >
              <template #append>
                <v-btn
                  v-if="filesSource === 'usb'"
                  icon
                  variant="text"
                  size="small"
                  title="Start print"
                  :disabled="!isOnline"
                  @click.stop="startUsbPrint(f.path)"
                >
                  <v-icon size="18">play_arrow</v-icon>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  title="Delete"
                  @click.stop="deleteFile(f.path)"
                >
                  <v-icon size="18">delete_outline</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </div>
      </v-tabs-window-item>

      <!-- ========== HISTORY ========== -->
      <v-tabs-window-item value="history">
        <div class="pa-3">
          <v-row dense>
            <v-col v-for="stat in stats" :key="stat.label" cols="6" sm="3">
              <v-card variant="tonal" :color="stat.color">
                <v-card-text class="py-3">
                  <div class="text-caption text-medium-emphasis">{{ stat.label }}</div>
                  <div class="text-h6 mt-1">{{ stat.value }}</div>
                  <div v-if="stat.sub" class="text-caption text-medium-emphasis mt-1">
                    {{ stat.sub }}
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <div v-if="durationChartData.length > 0" class="mt-5">
            <div class="text-overline text-medium-emphasis mb-1">
              Estimated vs actual duration (last {{ durationChartData.length }} completed prints)
            </div>
            <svg
              :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
              class="pdv-chart"
              preserveAspectRatio="none"
              role="img"
            >
              <g
                v-for="(d, idx) in durationChartData"
                :key="d.jobId"
                :transform="`translate(${idx * (barGroupWidth + barGap)}, 0)`"
              >
                <rect
                  :x="0"
                  :y="chartHeight - estimatedHeight(d)"
                  :width="barWidth"
                  :height="estimatedHeight(d)"
                  rx="1"
                  fill="rgba(120, 160, 200, 0.45)"
                >
                  <title>Estimated: {{ formatDuration(d.estimatedSeconds) }}</title>
                </rect>
                <rect
                  :x="barWidth + 1"
                  :y="chartHeight - actualHeight(d)"
                  :width="barWidth"
                  :height="actualHeight(d)"
                  rx="1"
                  :fill="d.actualSeconds > d.estimatedSeconds ? '#e07a5f' : '#7ac74f'"
                >
                  <title>Actual: {{ formatDuration(d.actualSeconds) }}</title>
                </rect>
              </g>
            </svg>
          </div>

          <div class="mt-5">
            <div class="d-flex align-center mb-2">
              <div class="text-overline text-medium-emphasis">Recent jobs</div>
              <v-spacer />
              <v-progress-circular
                v-if="historyLoading"
                indeterminate
                size="16"
                width="2"
              />
            </div>
            <v-data-table
              :headers="historyHeaders"
              :items="historyItems"
              :loading="historyLoading"
              density="comfortable"
              hover
              class="pdv-table"
            >
              <template #item.status="{ item }">
                <v-chip
                  :color="statusColor(item.status)"
                  size="x-small"
                  variant="tonal"
                  density="comfortable"
                >
                  {{ statusLabel(item.status) }}
                </v-chip>
              </template>
              <template #item.startedAt="{ item }">
                {{ formatDateOrDash(item.startedAt) }}
              </template>
              <template #item.duration="{ item }">
                {{ formatDuration(item.durationSeconds) }}
              </template>
              <template #item.estimated="{ item }">
                {{ formatDuration(item.estimatedSeconds) }}
              </template>
              <template #item.delta="{ item }">
                <span
                  v-if="item.deltaSeconds !== null"
                  :class="item.deltaSeconds >= 0 ? 'text-error' : 'text-success'"
                >
                  {{ item.deltaSeconds >= 0 ? '+' : '' }}{{ formatDuration(Math.abs(item.deltaSeconds)) }}
                </span>
                <span v-else class="text-medium-emphasis">—</span>
              </template>
            </v-data-table>
          </div>
        </div>
      </v-tabs-window-item>

      <!-- ========== MAINTENANCE ========== -->
      <v-tabs-window-item value="maintenance">
        <div class="pa-3">
          <div class="d-flex align-center mb-3">
            <v-btn
              size="small"
              color="primary"
              variant="tonal"
              prepend-icon="build"
              @click="openCreateMaintenance"
            >
              Log maintenance
            </v-btn>
            <v-spacer />
            <v-progress-circular
              v-if="maintenanceLoading"
              indeterminate
              size="16"
              width="2"
            />
          </div>
          <div v-if="maintenanceLogs.length === 0 && !maintenanceLoading" class="pdv-empty">
            <p class="text-body-2 text-medium-emphasis">
              No maintenance entries yet for this printer.
            </p>
          </div>
          <div v-else class="pdv-maint-list">
            <div
              v-for="log in maintenanceLogs"
              :key="log.id"
              class="pdv-maint-row"
              :class="{ 'pdv-maint-row--active': !log.completed }"
            >
              <div class="d-flex align-center flex-wrap">
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="log.completed ? 'success' : 'warning'"
                  density="comfortable"
                >
                  {{ log.completed ? 'Resolved' : 'Active' }}
                </v-chip>
                <span class="text-body-2 ml-2">
                  {{ log.metadata?.cause || 'Unspecified cause' }}
                </span>
                <v-spacer />
                <span class="text-caption text-medium-emphasis">
                  {{ formatDateOrDash(log.createdAt) }} · {{ log.createdBy || 'unknown' }}
                </span>
                <v-btn
                  v-if="!log.completed"
                  size="x-small"
                  variant="text"
                  color="success"
                  class="ml-2"
                  :loading="completingLogId === log.id"
                  @click="completeMaintenance(log.id)"
                >
                  Mark complete
                </v-btn>
              </div>
              <div
                v-if="log.metadata?.notes"
                class="text-caption text-medium-emphasis mt-1"
              >
                {{ log.metadata.notes }}
              </div>
              <div
                v-if="log.metadata?.partsInvolved?.length"
                class="mt-1"
              >
                <v-chip
                  v-for="part in log.metadata.partsInvolved"
                  :key="part"
                  size="x-small"
                  variant="outlined"
                  density="comfortable"
                  class="mr-1"
                >
                  {{ part }}
                </v-chip>
              </div>
            </div>
          </div>
        </div>
      </v-tabs-window-item>

      <!-- ========== SETTINGS ========== -->
      <v-tabs-window-item value="settings">
        <div class="pa-3">
          <div class="d-flex align-center mb-3">
            <span class="text-overline text-medium-emphasis">Printer configuration</span>
            <v-spacer />
            <v-btn
              size="small"
              color="primary"
              variant="tonal"
              prepend-icon="edit"
              @click="openEditDialog"
            >
              Edit printer
            </v-btn>
          </div>

          <v-row dense>
            <v-col cols="12" md="6">
              <v-card variant="tonal" class="pdv-card">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" color="primary">info</v-icon>
                  Connection
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <dl class="pdv-info">
                    <dt>Name</dt><dd>{{ printer.name }}</dd>
                    <dt>URL</dt><dd>
                      <a :href="printer.printerURL" target="_blank" rel="noopener">
                        {{ printer.printerURL }}
                      </a>
                    </dd>
                    <dt>Type</dt><dd>{{ printerTypeLabel }}</dd>
                    <dt>Enabled</dt><dd>{{ printer.enabled ? 'Yes' : 'No' }}</dd>
                    <dt v-if="printer.disabledReason">Reason</dt>
                    <dd v-if="printer.disabledReason">{{ printer.disabledReason }}</dd>
                    <dt>Created</dt><dd>{{ formatDateOrDash(printer.dateAdded ? new Date(printer.dateAdded) : null) }}</dd>
                  </dl>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card variant="tonal" class="pdv-card">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" color="primary">memory</v-icon>
                  Runtime
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <dl class="pdv-info">
                    <dt>Socket</dt><dd>{{ socketStateText }}</dd>
                    <dt>API</dt><dd>{{ apiStateText }}</dd>
                    <dt>State</dt><dd>{{ printerState?.text ?? '—' }}</dd>
                    <dt>Last update</dt>
                    <dd :title="lastSeenIso ?? ''">{{ lastSeenLabel }}</dd>
                  </dl>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>
      </v-tabs-window-item>
    </v-tabs-window>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { usePrinterStore } from '@/store/printer.store'
import { usePrinterStateStore } from '@/store/printer-state.store'
import { PrintJobService, PrintJobDto } from '@/backend/print-job.service'
import { PrintQueueService, QueuedJob } from '@/backend/print-queue.service'
import { PrinterMaintenanceLogService } from '@/backend/printer-maintenance-log.service'
import { PrinterRemoteFileService } from '@/backend/printer-remote-file.service'
import type { PrinterMaintenanceLog } from '@/models/printers/printer-maintenance-log.model'
import type { FilesDto, FileDto } from '@/models/printers/printer-file.model'
import { usePrinterTileThumbnailQuery } from '@/queries/printer-tile-thumbnail.query'
import { interpretStates } from '@/shared/printer-state.constants'
import { useDialog } from '@/shared/dialog.composable'
import { DialogName } from '@/components/Generic/Dialogs/dialog.constants'
import { useSnackbar } from '@/shared/snackbar.composable'
import { useFileExplorer } from '@/shared/file-explorer.composable'
import { confirm as confirmDialog } from '@/shared/confirm-dialog.composable'

const props = defineProps<{ printerId: number }>()

const router = useRouter()
const route = useRoute()
const printerStore = usePrinterStore()
const printerStateStore = usePrinterStateStore()
const maintenanceDialog = useDialog(DialogName.PrinterMaintenanceDialog)
const controlDialog = useDialog(DialogName.PrinterControlDialog)
const addOrUpdateDialog = useDialog(DialogName.AddOrUpdatePrinterDialog)
const fileExplorer = useFileExplorer()
const snackbar = useSnackbar()

type TabName = 'overview' | 'files' | 'history' | 'maintenance' | 'settings'
const TAB_NAMES: TabName[] = ['overview', 'files', 'history', 'maintenance', 'settings']
const tab = ref<TabName>('overview')

// Track the open tab in the URL so reload / share keeps you on the same panel.
onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const t = params.get('tab') as TabName | null
  if (t && TAB_NAMES.includes(t)) tab.value = t

  // Tile's Move/Home button funnels through here with ?autoOpen=control
  // — open the jog dialog as soon as the view mounts, then strip the
  // param so a refresh doesn't re-pop the dialog.
  if (route.query.autoOpen === 'control') {
    void openControlDialog()
    const next = new URLSearchParams(window.location.search)
    next.delete('autoOpen')
    const qs = next.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? '?' + qs : ''}`)
  }
})
watch(tab, (next) => {
  const params = new URLSearchParams(window.location.search)
  if (next === 'overview') params.delete('tab')
  else params.set('tab', next)
  const url = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`
  window.history.replaceState(null, '', url)
})

async function openControlDialog() {
  if (!printer.value) return
  await controlDialog.openDialog({ printer: printer.value })
}

async function openEditDialog() {
  if (!props.printerId) return
  await addOrUpdateDialog.openDialog({ id: props.printerId })
}

// ── Printer + live state ──
const printer = computed(() => printerStore.printer(props.printerId))
const printerEvents = computed(() => printerStateStore.printerEventsById[props.printerId])
const socketState = computed(() => printerStateStore.socketStatesById[props.printerId])
const printerState = computed(() => {
  if (!printer.value) return null
  return interpretStates(printer.value, socketState.value, printerEvents.value)
})

const stateChipText = computed(() => printer.value?.disabledReason ? 'Maintenance' : (printerState.value?.text || '—'))
const stateChipColor = computed(() => {
  if (printer.value?.disabledReason) return 'warning'
  if (isPrinting.value) return 'success'
  if (isPaused.value) return 'warning'
  if (!isOnline.value) return 'error'
  return 'grey-darken-1'
})

const isOnline = computed(() => socketState.value?.api === 'responding')
const flags = computed(() => printerEvents.value?.current?.payload?.state?.flags)
const isPrinting = computed(() => !!flags.value?.printing)
const isPaused = computed(() => !!flags.value?.paused || !!flags.value?.pausing)

const firmwareMessage = computed<string | null>(() => {
  const msg = (printerEvents.value?.current?.payload as any)?.printerMessage
  if (!msg || typeof msg !== 'string') return null
  const trimmed = msg.trim()
  if (!trimmed || trimmed.toLowerCase() === 'ok') return null
  return trimmed
})

// ── Current print (live polling) ──
const currentJob = computed(() => printerStateStore.printerJobsById[props.printerId])
const currentFileName = computed(() => {
  const job: any = currentJob.value
  return job?.job?.file?.display ?? job?.job?.file?.name ?? job?.job?.file?.path ?? null
})
const progressPercent = computed(() => {
  const c = currentJob.value?.progress?.completion
  return typeof c === 'number' ? c.toFixed(1) : '0.0'
})

const timeRemainingSeconds = computed<number | null>(() => {
  const v = currentJob.value?.progress?.printTimeLeft
  return typeof v === 'number' && v > 0 ? v : null
})
const timeRemainingFormatted = computed<string | null>(() => {
  const t = timeRemainingSeconds.value
  if (t === null) return null
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${Math.floor(t)}s`
})
const etaClockFormatted = computed<string | null>(() => {
  const t = timeRemainingSeconds.value
  if (t === null) return null
  const eta = new Date(Date.now() + t * 1000)
  const hh = String(eta.getHours()).padStart(2, '0')
  const mm = String(eta.getMinutes()).padStart(2, '0')
  const sameDay = eta.toDateString() === new Date().toDateString()
  return sameDay ? `${hh}:${mm}` : `${hh}:${mm} +1d`
})

const temps = computed(() => {
  const arr: any[] = (printerEvents.value?.current?.payload as any)?.temps
  if (!arr?.length) return null
  return arr[arr.length - 1]
})
const toolTempStr = computed(() => {
  const t = temps.value?.tool0
  return t ? `${Math.round(t.actual)}°/${Math.round(t.target)}°` : null
})
const bedTempStr = computed(() => {
  const t = temps.value?.bed
  return t ? `${Math.round(t.actual)}°/${Math.round(t.target)}°` : null
})

const printerIdRef = computed(() => props.printerId)
const { data: thumbnailRecord } = usePrinterTileThumbnailQuery(printerIdRef)
const thumbnail = computed(() => thumbnailRecord.value?.thumbnailBase64 ?? '')

// ── Queue ──
const queue = ref<QueuedJob[]>([])
const queueLoading = ref(false)
async function loadQueue() {
  queueLoading.value = true
  try {
    const response = await PrintQueueService.getPrinterQueue(props.printerId)
    queue.value = response.queue ?? []
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not load queue',
      subtitle: e?.message ?? 'Unknown error',
    })
  } finally {
    queueLoading.value = false
  }
}

// ── History (via TanStack so the page reflects backend changes on
//    refocus/window-focus the same way the dialog did) ──
const { data: pagedJobs, isLoading: historyLoading } = useQuery({
  queryKey: ['printer-detail-view', () => props.printerId],
  queryFn: async () =>
    PrintJobService.searchJobsPaged({
      searchPrinter: String(props.printerId),
      page: 1,
      pageSize: 50,
    }),
})
const jobs = computed<PrintJobDto[]>(() => pagedJobs.value?.items ?? [])

const stats = computed(() => {
  const completed = jobs.value.filter((j) => j.status === 'COMPLETED')
  const failed = jobs.value.filter((j) => j.status === 'FAILED')
  const cancelled = jobs.value.filter((j) => j.status === 'CANCELLED')
  const totalFilament = completed.reduce(
    (s, j) => s + filamentTotal(j.metadata?.filamentUsedGrams),
    0,
  )
  const totalSeconds = completed.reduce(
    (s, j) => s + (j.statistics?.actualPrintTimeSeconds ?? 0),
    0,
  )
  return [
    { label: 'Completed', value: String(completed.length), sub: `${jobs.value.length} scanned`, color: 'success' },
    { label: 'Failed', value: String(failed.length), sub: `+ ${cancelled.length} cancelled`, color: failed.length > 0 ? 'error' : 'default' },
    { label: 'Filament', value: totalFilament > 0 ? `${(totalFilament / 1000).toFixed(2)} kg` : '0 g', sub: 'across completed', color: 'primary' },
    { label: 'Print time', value: formatDurationCompact(totalSeconds), sub: 'cumulative', color: 'primary' },
  ]
})

interface HistoryRow {
  jobId: number
  status: string
  fileName: string
  startedAt: Date | string | null
  durationSeconds: number | null
  estimatedSeconds: number | null
  deltaSeconds: number | null
}

const historyHeaders = [
  { title: 'Status', key: 'status' },
  { title: 'File', key: 'fileName' },
  { title: 'Started', key: 'startedAt' },
  { title: 'Duration', key: 'duration' },
  { title: 'Estimated', key: 'estimated' },
  { title: 'Δ', key: 'delta' },
]

const historyItems = computed<HistoryRow[]>(() =>
  jobs.value.map((j) => {
    const duration = j.statistics?.actualPrintTimeSeconds ?? null
    const estimated = j.metadata?.gcodePrintTimeSeconds ?? null
    return {
      jobId: j.id,
      status: j.status,
      fileName: j.fileName,
      startedAt: j.startedAt,
      durationSeconds: duration,
      estimatedSeconds: estimated,
      deltaSeconds: duration !== null && estimated !== null ? duration - estimated : null,
    }
  }),
)

// Bar-chart data (same as the dialog version).
interface ChartPoint {
  jobId: number
  estimatedSeconds: number
  actualSeconds: number
}
const durationChartData = computed<ChartPoint[]>(() => {
  const out: ChartPoint[] = []
  for (const j of jobs.value) {
    if (j.status !== 'COMPLETED') continue
    const est = j.metadata?.gcodePrintTimeSeconds ?? null
    const act = j.statistics?.actualPrintTimeSeconds ?? null
    if (est && act) out.push({ jobId: j.id, estimatedSeconds: est, actualSeconds: act })
    if (out.length >= 16) break
  }
  return out.reverse()
})

const chartWidth = 960
const chartHeight = 110
const barGap = 6
const barGroupWidth = computed(() => {
  const groups = Math.max(1, durationChartData.value.length)
  return Math.max(8, (chartWidth - barGap * (groups - 1)) / groups - 1)
})
const barWidth = computed(() => Math.max(3, barGroupWidth.value / 2 - 1))
const chartMaxSeconds = computed(() => {
  let max = 0
  for (const d of durationChartData.value) {
    if (d.estimatedSeconds > max) max = d.estimatedSeconds
    if (d.actualSeconds > max) max = d.actualSeconds
  }
  return max
})
function estimatedHeight(d: ChartPoint): number {
  const max = chartMaxSeconds.value
  if (!max) return 0
  return Math.round((d.estimatedSeconds / max) * (chartHeight - 4))
}
function actualHeight(d: ChartPoint): number {
  const max = chartMaxSeconds.value
  if (!max) return 0
  return Math.round((d.actualSeconds / max) * (chartHeight - 4))
}

// ── Files (printer USB + file storage) ──
const filesSource = ref<'usb' | 'storage'>('usb')
const filesPath = ref<string>('')
const filesData = ref<FilesDto | null>(null)
const filesLoading = ref(false)

const filesBreadcrumb = computed(() =>
  filesPath.value ? filesPath.value.split('/').filter(Boolean) : [],
)

function leafName(p: string): string {
  return p.split(/[/\\]/).filter(Boolean).pop() ?? p
}
function parentPathOf(p: string): string {
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}
function fileSubtitle(f: FileDto): string {
  const parts: string[] = []
  if (typeof f.size === 'number') {
    if (f.size < 1024) parts.push(`${f.size} B`)
    else if (f.size < 1024 * 1024) parts.push(`${(f.size / 1024).toFixed(0)} KB`)
    else parts.push(`${(f.size / 1024 / 1024).toFixed(1)} MB`)
  }
  if (typeof f.date === 'number') {
    parts.push(new Date(f.date * 1000).toLocaleDateString())
  }
  return parts.join(' · ')
}

async function loadFiles() {
  if (!props.printerId) return
  filesLoading.value = true
  try {
    if (filesSource.value === 'usb') {
      const data = await PrinterRemoteFileService.getFiles(
        props.printerId,
        false,
        filesPath.value || undefined,
      )
      filesData.value = data
    } else {
      // File storage isn't per-printer — show a placeholder pointing the
      // user to the global file explorer for that source. Keeps the tab
      // useful without duplicating the entire file-storage controller's
      // listing surface here.
      filesData.value = { dirs: [], files: [] }
    }
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not load files',
      subtitle: e?.message ?? 'Unknown error',
    })
    filesData.value = { dirs: [], files: [] }
  } finally {
    filesLoading.value = false
  }
}

function navigateFilesTo(path: string) {
  filesPath.value = path
  void loadFiles()
}

async function startUsbPrint(path: string) {
  if (!props.printerId) return
  try {
    await PrinterRemoteFileService.selectAndPrintFile(props.printerId, path, true)
    snackbar.openInfoMessage({ title: 'Print started', subtitle: leafName(path) })
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not start print',
      subtitle: e?.message ?? 'Unknown error',
    })
  }
}

async function deleteFile(path: string) {
  if (!props.printerId) return
  const ok = await confirmDialog({
    title: 'Delete file?',
    message: leafName(path),
    confirmText: 'Delete',
    severity: 'danger',
  })
  if (!ok) return
  try {
    await PrinterRemoteFileService.deleteFileOrFolder(props.printerId, path)
    snackbar.openInfoMessage({ title: 'File deleted', subtitle: leafName(path) })
    await loadFiles()
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not delete',
      subtitle: e?.message ?? 'Unknown error',
    })
  }
}

function openSideNavExplorer() {
  if (!printer.value) return
  fileExplorer.openFileExplorer(printer.value)
}

watch(filesSource, () => {
  filesPath.value = ''
  void loadFiles()
})

// ── Maintenance ──
const maintenanceLogs = ref<PrinterMaintenanceLog[]>([])
const maintenanceLoading = ref(false)
const completingLogId = ref<number | null>(null)
async function loadMaintenance() {
  maintenanceLoading.value = true
  try {
    const response = await PrinterMaintenanceLogService.listLogs({
      printerId: props.printerId,
      page: 1,
      pageSize: 50,
    })
    const list = response.logs ?? []
    maintenanceLogs.value = [
      ...list.filter((l) => !l.completed),
      ...list.filter((l) => l.completed),
    ]
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not load maintenance',
      subtitle: e?.message ?? 'Unknown error',
    })
  } finally {
    maintenanceLoading.value = false
  }
}
async function openCreateMaintenance() {
  await maintenanceDialog.openDialog({ printerId: props.printerId })
  await loadMaintenance()
}
async function completeMaintenance(id: number) {
  completingLogId.value = id
  try {
    await PrinterMaintenanceLogService.complete(id, {})
    await loadMaintenance()
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not complete',
      subtitle: e?.message ?? 'Unknown error',
    })
  } finally {
    completingLogId.value = null
  }
}

// ── Connection info ──
const printerTypeLabel = computed(() => {
  // 2 = PrusaLink (per server's PrinterTypesEnum). Future types should
  // get added here; falling back to the raw number is fine for unknown.
  return printer.value?.printerType === 2 ? 'PrusaLink' : String(printer.value?.printerType ?? '—')
})
const socketStateText = computed(() => socketState.value?.socket ?? '—')
const apiStateText = computed(() => socketState.value?.api ?? '—')
const lastSeenMs = computed(() => printerStateStore.printerCurrentEventReceivedAtById[props.printerId] ?? null)
const lastSeenIso = computed(() => (lastSeenMs.value ? new Date(lastSeenMs.value).toISOString() : null))
const lastSeenLabel = computed(() => {
  const ts = lastSeenMs.value
  if (!ts) return 'never'
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 60) return `${sec}s ago`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
})

// ── Initial loads / reactive reloads on printerId / tab change ──
watch(
  () => props.printerId,
  () => {
    void loadQueue()
    void loadMaintenance()
  },
  { immediate: true },
)
// Refresh queue / maintenance / files when entering their respective
// tabs, so the user sees fresh data even if they sat on Overview for a
// while.
watch(
  tab,
  (next) => {
    if (next === 'overview') void loadQueue()
    if (next === 'maintenance') void loadMaintenance()
    if (next === 'files') void loadFiles()
  },
  { immediate: true },
)

// ── Formatters ──
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${Math.floor(seconds)}s`
}
function formatDurationCompact(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
function formatDateOrDash(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function statusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'success'
    case 'FAILED': return 'error'
    case 'CANCELLED': return 'warning'
    case 'PRINTING': case 'STARTING': return 'primary'
    case 'PAUSED': return 'orange'
    default: return 'default'
  }
}
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pending', QUEUED: 'Queued', STARTING: 'Transferring',
    PRINTING: 'Printing', PAUSED: 'Paused', COMPLETED: 'Completed',
    FAILED: 'Failed', CANCELLED: 'Cancelled', UNKNOWN: 'Unknown',
  }
  return map[status] ?? status
}
function filamentTotal(v: number | number[] | null | undefined): number {
  if (v == null) return 0
  if (Array.isArray(v)) return v.reduce((a, b) => a + (b || 0), 0)
  return v
}
</script>

<style scoped>
.pdv {
  max-width: 1280px;
  margin: 0 auto;
}

.pdv-missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
  text-align: center;
}

.pdv-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.pdv-title {
  font-weight: 600;
}

.pdv-fw-msg {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdv-tabs {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.pdv-card {
  height: 100%;
}

.pdv-empty {
  padding: 24px;
  text-align: center;
}

.pdv-current {
  display: flex;
  gap: 16px;
}

.pdv-current__thumb {
  flex: 0 0 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  min-height: 180px;
}

.pdv-current__info {
  flex: 1 1 auto;
  min-width: 0;
}

.pdv-temps {
  font-size: 14px;
}

.pdv-queue-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pdv-queue-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
}

.pdv-queue-row--starting {
  background: rgba(var(--v-theme-primary), 0.1);
}

.pdv-queue-row__pos {
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.6);
  min-width: 24px;
}

.pdv-queue-row__name {
  flex: 1 1 auto;
  min-width: 0;
}

.pdv-chart {
  width: 100%;
  height: 110px;
  display: block;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  padding: 2px 4px;
}

.pdv-table :deep(.v-data-table-footer) {
  display: none;
}

.pdv-maint-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pdv-maint-row {
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.pdv-maint-row--active {
  border-color: rgba(var(--v-theme-warning), 0.4);
  background: rgba(var(--v-theme-warning), 0.06);
}

.pdv-info {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 6px 12px;
  font-size: 14px;
}

.pdv-info dt {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-weight: 500;
}

.pdv-info dd {
  margin: 0;
  word-break: break-all;
}

.pdv-crumb {
  color: rgba(var(--v-theme-primary), 0.85);
  text-decoration: none;
}
.pdv-crumb:hover {
  text-decoration: underline;
}

.pdv-files {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}
</style>
