<script setup lang="ts">
import { computed, ref } from "vue";
import { useDialog } from "@/shared/dialog.composable";
import { DialogName } from "@/components/Generic/Dialogs/dialog.constants";
import { convertMultiPrinterFileToQueue } from "@/utils/uploads-state.utils";
import { PrinterDto } from "@/models/printers/printer.model";
import { PrintersService } from "@/backend";
import { usePrinterStore } from "@/store/printer.store";
import { usePrinterStateStore } from "@/store/printer-state.store";
import { useUploadsStore } from "@/store/uploads.store";
import { useSnackbar } from "@/shared/snackbar.composable";
import { formatFileSize } from "@/utils/file-size.util";

const printersStore = usePrinterStore()
const printerStateStore = usePrinterStateStore()
const uploadsStore = useUploadsStore()
const snackbar = useSnackbar()

const selectedFile = ref<File | undefined>(undefined)
const fileUpload = ref<HTMLInputElement | null>(null)

const selectedPrinters = computed(() => printersStore.selectedPrinters)
const hasPrintersSelected = computed(() => selectedPrinters.value.length > 0)
const hasFile = computed(() => !!selectedFile.value)

const filesSelected = () => {
  selectedFile.value = fileUpload.value?.files?.[0]
}

const deselectFile = () => {
  if (fileUpload.value) {
    fileUpload.value.value = ''
  }
  selectedFile.value = undefined
}

const batchReprintFiles = async () => {
  const printerIds = selectedPrinters.value.map(p => p.id) ?? []
  await useDialog(DialogName.BatchReprintDialog).handleAsync(printerIds as any)
}

const uploadFile = (startPrint: boolean) => {
  const accessible = selectedPrinters.value.filter(p =>
    printerStateStore.isApiResponding(p.id)
  )
  if (!selectedFile.value) return

  const skipped = selectedPrinters.value.length - accessible.length
  if (skipped > 0) {
    snackbar.openInfoMessage({
      title: `${skipped} printer(s) inaccessible`,
      subtitle: 'These were skipped from uploading.'
    })
  }

  const uploads = convertMultiPrinterFileToQueue(
    accessible,
    selectedFile.value,
    startPrint
  )
  uploadsStore.queueUploads(uploads)

  if (fileUpload.value) fileUpload.value.value = ''
  selectedFile.value = undefined
  clearSelectedPrinters()
}

const deselectPrinter = (printer: PrinterDto) => {
  printersStore.toggleSelectedPrinter(printer)
}

const clearSelectedPrinters = () => {
  printersStore.clearSelectedPrinters()
}

const openPrinter = (printer: PrinterDto) => {
  PrintersService.openPrinterURL(printer.printerURL)
}
</script>

<template>
  <div
    v-drop-upload="{ printers: selectedPrinters }"
    class="batch-bar"
    :class="{
      'batch-bar--idle': !hasPrintersSelected,
      'batch-bar--ready': hasPrintersSelected && !hasFile,
      'batch-bar--armed': hasPrintersSelected && hasFile,
    }"
  >
    <!-- ─── Selection summary (left) ───────────────────────────── -->
    <div class="batch-bar__selection">
      <template v-if="!hasPrintersSelected">
        <v-icon size="small" color="medium-emphasis">touch_app</v-icon>
        <span class="text-body-2 text-medium-emphasis">
          Click printers to select for batch upload or reprint
        </span>
      </template>
      <template v-else>
        <v-chip
          color="primary"
          variant="flat"
          size="small"
          class="font-weight-bold flex-shrink-0"
        >
          {{ selectedPrinters.length }} selected
        </v-chip>
        <div class="batch-bar__chips">
          <v-chip
            v-for="p in selectedPrinters"
            :key="p.id"
            closable
            color="primary"
            variant="tonal"
            size="small"
            @click="openPrinter(p)"
            @click:close="deselectPrinter(p)"
          >
            {{ p.name }}
          </v-chip>
        </div>
        <button
          type="button"
          class="batch-bar__clear-btn"
          aria-label="Clear selection"
          @click="clearSelectedPrinters()"
        >
          <v-icon size="16">close</v-icon>
          <v-tooltip activator="parent" location="top">Clear selection</v-tooltip>
        </button>
      </template>
    </div>

    <!-- ─── Actions (right) ────────────────────────────────────── -->
    <div class="batch-bar__actions">
      <!-- File pill (only when one is staged) -->
      <div
        v-if="selectedFile"
        class="batch-bar__file"
        @click="fileUpload?.click()"
      >
        <v-icon size="18" class="batch-bar__file-icon">description</v-icon>
        <span
          class="batch-bar__file-name text-truncate"
          :title="selectedFile.name"
        >
          {{ selectedFile.name }}
        </span>
        <span class="batch-bar__file-size">
          {{ formatFileSize(selectedFile.size) }}
        </span>
        <button
          type="button"
          class="batch-bar__file-close"
          aria-label="Remove file"
          @click.stop="deselectFile()"
        >
          <v-icon size="16">close</v-icon>
        </button>
      </div>

      <!-- Pick file -->
      <v-btn
        v-if="!selectedFile"
        variant="tonal"
        size="small"
        prepend-icon="folder_open"
        @click="fileUpload?.click()"
      >
        Select file
      </v-btn>

      <!-- Upload: stages the file on the selected printers' USB. The
           print itself is started from the per-printer queue so every
           job is recorded in /jobs. -->
      <v-btn
        :disabled="!hasFile || !hasPrintersSelected"
        color="success"
        variant="flat"
        size="small"
        prepend-icon="upload"
        @click="uploadFile(false)"
      >
        Upload
        <v-tooltip activator="parent" location="bottom">
          Queue and start from the Print Jobs view.
        </v-tooltip>
      </v-btn>

      <v-divider vertical class="mx-1 my-2" />

      <!-- Batch reprint -->
      <v-btn
        :disabled="!hasPrintersSelected"
        variant="text"
        size="small"
        prepend-icon="restart_alt"
        @click="batchReprintFiles()"
      >
        Batch reprint
      </v-btn>

      <input
        ref="fileUpload"
        :multiple="false"
        accept=".gcode,.3mf,.bgcode"
        style="display: none"
        type="file"
        @change="filesSelected()"
      />
    </div>
  </div>
</template>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  position: relative;
  transition: background-color 0.2s ease;
}

/* Visual state: "armed" (file + printers ready) gets a subtle success tint */
.batch-bar--armed {
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-surface)) 0%,
    rgba(var(--v-theme-success), 0.06) 100%
  );
  border-bottom-color: rgba(var(--v-theme-success), 0.3);
}

.batch-bar--ready {
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-surface)) 0%,
    rgba(var(--v-theme-primary), 0.04) 100%
  );
}

/* ─── Selection (left) ───────────────────────────────────────── */
.batch-bar__selection {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
}

.batch-bar__chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
  min-width: 0;
  scrollbar-width: thin;
  padding-bottom: 2px;
}

.batch-bar__chips::-webkit-scrollbar {
  height: 4px;
}

.batch-bar__chips::-webkit-scrollbar-track {
  background: transparent;
}

.batch-bar__chips::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 2px;
}

/* ─── Actions (right) ────────────────────────────────────────── */
.batch-bar__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* ─── File pill ──────────────────────────────────────────────── */
.batch-bar__file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 460px;
  padding: 5px 6px 5px 12px;
  border: 1px dashed rgba(var(--v-theme-success), 0.5);
  border-radius: 6px;
  background: rgba(var(--v-theme-success), 0.08);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.batch-bar__file:hover {
  border-color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.12);
}

.batch-bar__file-icon {
  flex-shrink: 0;
  color: rgb(var(--v-theme-success));
}

.batch-bar__file-name {
  flex: 1 1 auto;
  min-width: 0;
}

.batch-bar__file-size {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* ─── Plain icon buttons (avoid v-btn sizing quirks) ─────────── */
.batch-bar__file-close,
.batch-bar__clear-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.65);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.batch-bar__file-close:hover,
.batch-bar__clear-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-on-surface));
}

.batch-bar__file-close:focus-visible,
.batch-bar__clear-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}
</style>
