<template>
  <div class="intake pa-4">
    <!-- ─── Header ─────────────────────────────────────────── -->
    <div class="intake-header d-flex align-center mb-4">
      <v-icon size="28" class="mr-2">mdi:mdi-tray-arrow-down</v-icon>
      <h2 class="text-h6 mb-0">Intake</h2>
      <v-chip v-if="items.length" size="small" color="primary" variant="flat" class="ml-3 font-weight-bold">
        {{ items.length }} pending
      </v-chip>
      <v-spacer />
      <v-btn :loading="loading" variant="tonal" size="small" icon="refresh" @click="load">
        <v-icon>refresh</v-icon>
        <v-tooltip activator="parent" location="bottom">Refresh</v-tooltip>
      </v-btn>
    </div>

    <p class="text-body-2 text-medium-emphasis mb-4">
      Files uploaded from a slicer land here. Choose where to save each one and which printer to run it on.
    </p>

    <!-- ─── Loading ────────────────────────────────────────── -->
    <div v-if="loading" class="d-flex justify-center py-10">
      <v-progress-circular indeterminate size="32" />
    </div>

    <!-- ─── Empty ──────────────────────────────────────────── -->
    <v-card v-else-if="items.length === 0" elevation="0" border class="text-center py-12">
      <v-icon size="56" color="grey-lighten-1" class="mb-3">mdi:mdi-tray</v-icon>
      <h3 class="text-subtitle-1">Inbox is empty</h3>
      <p class="text-caption text-medium-emphasis mt-1">
        Send a file from PrusaSlicer (Print Host: OctoPrint) to see it here.
      </p>
    </v-card>

    <!-- ─── Items ──────────────────────────────────────────── -->
    <v-card v-else elevation="0" border>
      <div
        v-for="item in items"
        :key="item.id"
        class="intake-row"
      >
        <IntakeThumbnailCell class="intake-row__thumb" :item="item" />

        <div class="intake-row__main">
          <div class="intake-row__name text-truncate" :title="item.originalFileName">
            {{ item.originalFileName }}
          </div>
          <div class="intake-row__meta">
            <v-chip size="x-small" variant="tonal" color="secondary">
              {{ sourceLabel(item.source) }}
            </v-chip>
            <v-chip v-if="item.fileFormat" size="x-small" variant="tonal">
              {{ item.fileFormat.toUpperCase() }}
            </v-chip>
            <v-chip v-if="filamentTypeText(item)" size="x-small" variant="tonal" color="orange">
              {{ filamentTypeText(item) }}
            </v-chip>
            <v-chip v-if="item.metadata?.printerModel" size="x-small" variant="tonal" color="primary">
              <v-icon start size="13">print</v-icon>{{ item.metadata.printerModel }}
            </v-chip>
            <v-chip v-if="item.metadata?.layerHeight" size="x-small" variant="tonal">
              <v-icon start size="13">height</v-icon>{{ item.metadata.layerHeight }}mm
            </v-chip>
            <v-chip v-if="item.metadata?.gcodePrintTimeSeconds" size="x-small" variant="tonal" color="info">
              <v-icon start size="13">schedule</v-icon>{{ formatDuration(item.metadata.gcodePrintTimeSeconds) }}
            </v-chip>
            <v-chip v-if="item.metadata?.filamentUsedGrams != null" size="x-small" variant="tonal" color="green">
              <v-icon start size="13">fitness_center</v-icon>{{ filamentText(item) }}
            </v-chip>
            <v-chip v-if="item.metadata?.totalLayers" size="x-small" variant="tonal">
              <v-icon start size="13">layers</v-icon>{{ item.metadata.totalLayers }} layers
            </v-chip>
            <v-chip size="x-small" variant="tonal">
              {{ formatFileSize(item.fileSize) }}
            </v-chip>
            <span class="text-caption text-medium-emphasis ml-1">{{ formatRelativeTime(item.createdAt) }}</span>
          </div>
        </div>

        <div class="intake-row__actions">
          <v-btn color="primary" variant="flat" size="small" prepend-icon="add_to_queue" @click="openDispatch(item)">
            Dispatch
          </v-btn>
          <v-btn variant="tonal" size="small" prepend-icon="mdi:mdi-content-save" @click="openArchive(item)">
            Save only
          </v-btn>
          <v-btn icon size="small" variant="text" color="error" @click="confirmDiscard(item)">
            <v-icon>delete</v-icon>
            <v-tooltip activator="parent" location="top">Discard (deletes the file)</v-tooltip>
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ─── Dispatch / Archive dialog ──────────────────────── -->
    <v-dialog v-model="dialog.open" max-width="640">
      <v-card v-if="dialog.item">
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">{{ dialog.mode === 'dispatch' ? 'add_to_queue' : 'mdi:mdi-content-save' }}</v-icon>
          {{ dialog.mode === 'dispatch' ? 'Dispatch to printer' : 'Save to folder' }}
          <v-spacer />
          <v-btn icon="close" variant="text" @click="dialog.open = false" />
        </v-card-title>

        <v-card-text>
          <div class="mb-4">
            <strong>File:</strong> {{ dialog.item.originalFileName }}
          </div>

          <!-- Folder selector (optional for dispatch, the point for archive) -->
          <div class="text-subtitle-2 mb-1">
            Folder
            <span v-if="dialog.mode === 'dispatch'" class="text-caption text-medium-emphasis">(optional)</span>
          </div>
          <v-select
            v-model="dialog.folderPath"
            :items="folderOptions"
            density="compact"
            variant="outlined"
            hide-details
            class="mb-4"
            prepend-inner-icon="folder"
          />

          <!-- Printer picker (dispatch only) -->
          <template v-if="dialog.mode === 'dispatch'">
            <div class="text-subtitle-2 mb-1">Printer</div>

            <div v-if="dialog.checkingCompat" class="d-flex justify-center py-4">
              <v-progress-circular indeterminate size="24" />
            </div>

            <template v-else>
              <v-alert
                v-if="dialog.compatiblePrinters.length === 0"
                type="warning"
                variant="tonal"
                density="compact"
              >
                No compatible printer for this file format.
              </v-alert>

              <v-list v-else class="pa-0" density="compact">
                <v-list-item
                  v-for="printer in dialog.compatiblePrinters"
                  :key="printer.id"
                  :active="dialog.printerId === printer.id"
                  class="intake-printer-row"
                  @click="dialog.printerId = printer.id"
                >
                  <template #prepend>
                    <v-radio
                      :model-value="dialog.printerId === printer.id"
                      :value="true"
                      hide-details
                      density="compact"
                      @click.stop="dialog.printerId = printer.id"
                    />
                  </template>
                  <v-list-item-title>
                    {{ printer.name }}
                    <v-chip
                      v-if="suggestedPrinterId === printer.id"
                      size="x-small"
                      color="success"
                      variant="flat"
                      class="ml-2"
                    >
                      Suggested
                    </v-chip>
                  </v-list-item-title>
                  <template #append>
                    <div class="d-flex align-center ga-2">
                      <v-chip
                        v-if="queueCountFor(printer.id) > 0"
                        size="x-small"
                        variant="tonal"
                        color="info"
                        prepend-icon="queue"
                      >
                        {{ queueCountFor(printer.id) }} queued
                      </v-chip>
                      <v-chip size="x-small" variant="tonal" :color="liveStatus(printer.id).color">
                        {{ liveStatus(printer.id).label }}
                        <template v-if="liveStatus(printer.id).timeLeftSeconds">
                          · {{ formatDuration(liveStatus(printer.id).timeLeftSeconds) }} left
                        </template>
                      </v-chip>
                    </div>
                  </template>
                </v-list-item>
              </v-list>

              <details v-if="dialog.incompatiblePrinters.length > 0" class="mt-3 intake-incompat">
                <summary class="text-caption text-medium-emphasis">
                  {{ dialog.incompatiblePrinters.length }} printer(s) hidden — incompatible
                </summary>
                <ul class="mt-2">
                  <li
                    v-for="p in dialog.incompatiblePrinters"
                    :key="p.id"
                    class="text-caption text-medium-emphasis"
                  >
                    <strong>{{ p.name }}</strong> · {{ p.incompatibilityReason || 'incompatible format' }}
                  </li>
                </ul>
              </details>
            </template>
          </template>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog.open = false">Cancel</v-btn>
          <v-btn
            v-if="dialog.mode === 'archive'"
            color="primary"
            variant="elevated"
            :loading="dialog.busy"
            @click="submitArchive"
          >
            Save to {{ dialog.folderPath ? folderLabel(dialog.folderPath) : 'Root' }}
          </v-btn>
          <v-btn
            v-else
            color="primary"
            variant="elevated"
            :disabled="!dialog.printerId"
            :loading="dialog.busy"
            @click="submitDispatch"
          >
            Queue to printer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { IntakeService, type IntakeItem } from '@/backend/intake.service'
import { PrintQueueService } from '@/backend/print-queue.service'
import { FileStorageService } from '@/backend/file-storage.service'
import { usePrinterStateStore } from '@/store/printer-state.store'
import { useSnackbar } from '@/shared/snackbar.composable'
import { confirm as confirmDialog } from '@/shared/confirm-dialog.composable'
import { formatDuration, formatRelativeTime } from '@/utils/date-time.utils'
import { formatFileSize } from '@/utils/file-size.util'
import { useOnIntakeChanged } from '@/shared/intake-invalidator.composable'
import { refreshIntakePendingCount } from '@/shared/intake-count.composable'
import IntakeThumbnailCell from './IntakeThumbnailCell.vue'

const snackbar = useSnackbar()
const printerStateStore = usePrinterStateStore()

const items = ref<IntakeItem[]>([])
const loading = ref(false)
const folderTree = ref<Array<{ path: string; name: string }>>([])

const dialog = reactive<{
  open: boolean
  mode: 'dispatch' | 'archive'
  item: IntakeItem | null
  folderPath: string | null
  printerId: number | null
  busy: boolean
  checkingCompat: boolean
  compatiblePrinters: Array<Record<string, any>>
  incompatiblePrinters: Array<Record<string, any> & { incompatibilityReason?: string }>
  queueCounts: Record<number, number>
}>({
  open: false,
  mode: 'dispatch',
  item: null,
  folderPath: null,
  printerId: null,
  busy: false,
  checkingCompat: false,
  compatiblePrinters: [],
  incompatiblePrinters: [],
  queueCounts: {},
})

const folderOptions = computed(() => [
  { title: 'Root', value: null },
  ...folderTree.value.map((f) => ({ title: f.path, value: f.path })),
])

function folderLabel(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function sourceLabel(source: string): string {
  if (source === 'prusaslicer') return 'PrusaSlicer'
  if (source === 'erp') return 'ERP'
  return 'API'
}

function filamentText(item: IntakeItem): string {
  const g = item.metadata?.filamentUsedGrams
  const total = Array.isArray(g) ? g.reduce((a, b) => a + (b || 0), 0) : g
  return total != null ? `${Math.round(total)}g` : ''
}

function filamentTypeText(item: IntakeItem): string {
  const t = item.metadata?.filamentType
  if (!t) return ''
  return Array.isArray(t) ? [...new Set(t)].join(', ') : t
}

async function load() {
  loading.value = true
  try {
    const res = await IntakeService.list()
    items.value = res.items
    void refreshIntakePendingCount()
  } catch (err) {
    console.error('Failed to load intake items:', err)
    snackbar.error('Failed to load intake items')
  } finally {
    loading.value = false
  }
}

async function loadFolderTree() {
  try {
    const res = await FileStorageService.getFolderTree()
    folderTree.value = res.folders.map((f) => ({ path: f.path, name: f.name }))
  } catch (err) {
    console.error('Failed to load folder tree:', err)
  }
}

// ── Live status / queue helpers (mirror QueueFileDialog) ────────
interface LiveStatus {
  label: string
  color: string
  timeLeftSeconds: number | null
}
function liveStatus(printerId: number): LiveStatus {
  if (!printerStateStore.isApiResponding(printerId)) {
    return { label: 'Offline', color: 'grey', timeLeftSeconds: null }
  }
  if (printerStateStore.isPrinterPrinting(printerId)) {
    const raw = printerStateStore.printerEventsById[printerId]?.current?.payload?.progress?.printTimeLeft
    return { label: 'Printing', color: 'success', timeLeftSeconds: typeof raw === 'number' && raw > 0 ? raw : null }
  }
  if (printerStateStore.isPrinterPaused(printerId)) {
    return { label: 'Paused', color: 'warning', timeLeftSeconds: null }
  }
  return { label: 'Idle', color: 'grey', timeLeftSeconds: null }
}
function queueCountFor(printerId: number): number {
  return dialog.queueCounts[printerId] ?? 0
}

// Suggested printer: first idle compatible one; else the one with the
// shortest queue. Mirrors the A→B rule from the design.
const suggestedPrinterId = computed<number | null>(() => {
  const printers = dialog.compatiblePrinters
  if (printers.length === 0) return null
  const idle = printers.find(
    (p) => printerStateStore.isApiResponding(p.id) && !printerStateStore.isPrinterPrinting(p.id) && !printerStateStore.isPrinterPaused(p.id),
  )
  if (idle) return idle.id
  return [...printers].sort((a, b) => queueCountFor(a.id) - queueCountFor(b.id))[0]?.id ?? null
})

function resetDialog(item: IntakeItem, mode: 'dispatch' | 'archive') {
  dialog.item = item
  dialog.mode = mode
  dialog.folderPath = null
  dialog.printerId = null
  dialog.busy = false
  dialog.compatiblePrinters = []
  dialog.incompatiblePrinters = []
  dialog.queueCounts = {}
  dialog.open = true
}

function openArchive(item: IntakeItem) {
  resetDialog(item, 'archive')
}

async function openDispatch(item: IntakeItem) {
  resetDialog(item, 'dispatch')
  dialog.checkingCompat = true
  try {
    const res = await PrintQueueService.getCompatiblePrinters({
      fileFormat: (item.fileFormat as any) || undefined,
    })
    dialog.compatiblePrinters = res.compatible.filter((p) => p.enabled !== false)
    dialog.incompatiblePrinters = res.incompatible
    // Fetch queue counts in parallel, best-effort.
    await Promise.all(
      dialog.compatiblePrinters.map(async (p) => {
        try {
          const q = await PrintQueueService.getPrinterQueue(p.id)
          dialog.queueCounts = { ...dialog.queueCounts, [p.id]: q.count }
        } catch { /* leave at 0 */ }
      }),
    )
    // Pre-select the suggestion.
    dialog.printerId = suggestedPrinterId.value
  } catch (err) {
    console.error('Failed to load compatible printers:', err)
    snackbar.error('Failed to load compatible printers')
  } finally {
    dialog.checkingCompat = false
  }
}

async function submitArchive() {
  if (!dialog.item) return
  dialog.busy = true
  try {
    await IntakeService.archive(dialog.item.id, dialog.folderPath)
    snackbar.info(`Saved to ${dialog.folderPath ? folderLabel(dialog.folderPath) : 'Root'}`)
    dialog.open = false
    await load()
  } catch (err: any) {
    snackbar.error(err?.response?.data?.error || err?.message || 'Failed to save file')
  } finally {
    dialog.busy = false
  }
}

async function submitDispatch() {
  if (!dialog.item || !dialog.printerId) return
  dialog.busy = true
  try {
    await IntakeService.dispatch(dialog.item.id, dialog.printerId, dialog.folderPath)
    snackbar.info('Queued to printer')
    dialog.open = false
    await load()
  } catch (err: any) {
    snackbar.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to dispatch')
  } finally {
    dialog.busy = false
  }
}

async function confirmDiscard(item: IntakeItem) {
  const ok = await confirmDialog({
    title: `Discard "${item.originalFileName}"?`,
    message: 'This permanently deletes the uploaded file.',
    hint: 'This cannot be undone.',
    confirmText: 'Discard',
    severity: 'danger',
    icon: 'delete',
  })
  if (!ok) return
  try {
    await IntakeService.discard(item.id)
    snackbar.info('File discarded')
    await load()
  } catch (err: any) {
    snackbar.error(err?.response?.data?.error || err?.message || 'Failed to discard')
  }
}

useOnIntakeChanged(() => {
  void load()
})

onMounted(() => {
  void load()
  void loadFolderTree()
})
</script>

<style scoped>
.intake-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.intake-row:last-child {
  border-bottom: none;
}

.intake-row__thumb {
  flex: 0 0 auto;
}

.intake-row__main {
  flex: 1 1 auto;
  min-width: 0;
}

.intake-row__name {
  font-size: 14px;
  font-weight: 600;
}

.intake-row__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.intake-row__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.intake-printer-row {
  border-radius: 6px;
}

.intake-incompat summary {
  cursor: pointer;
}
</style>
