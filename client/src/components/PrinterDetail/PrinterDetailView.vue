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
      <v-tab v-if="cameras.length > 0" value="cameras">
        Cameras
        <v-chip
          v-if="cameras.length > 1"
          size="x-small"
          class="ml-1"
          density="comfortable"
        >
          {{ cameras.length }}
        </v-chip>
      </v-tab>
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
          <!-- Toolbar -->
          <div class="d-flex align-center flex-wrap mb-2" style="gap: 8px;">
            <v-text-field
              v-model="filesSearch"
              prepend-inner-icon="search"
              placeholder="Filter…"
              density="compact"
              hide-details
              clearable
              style="max-width: 240px;"
            />
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="upload"
              :disabled="!isOnline || filesUploading"
              :loading="filesUploading"
              @click="filesInputRef?.click()"
            >
              Upload
            </v-btn>
            <input
              ref="filesInputRef"
              type="file"
              accept=".gcode,.bgcode,.3mf"
              style="display: none;"
              @change="onFilesPicked"
            >
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="create_new_folder"
              :disabled="!isOnline"
              @click="newFolderOpen = true"
            >
              New folder
            </v-btn>
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

          <!-- Breadcrumb row -->
          <div class="mb-2 text-body-2 text-medium-emphasis pdv-files-crumbs">
            <a href="#" class="pdv-crumb" @click.prevent="navigateFilesTo('')">root</a>
            <template v-for="(seg, i) in filesBreadcrumb" :key="i">
              <span class="mx-1">/</span>
              <a
                href="#"
                class="pdv-crumb"
                @click.prevent="navigateFilesTo(filesBreadcrumb.slice(0, i + 1).join('/'))"
              >{{ seg }}</a>
            </template>
          </div>

          <!-- Body -->
          <div v-if="filesLoading" class="pdv-empty">
            <v-progress-circular indeterminate size="20" width="2" />
          </div>
          <div
            v-else-if="!filesData || (filteredDirs.length === 0 && filteredFiles.length === 0)"
            class="pdv-empty"
          >
            <v-icon size="48" color="medium-emphasis">folder_off</v-icon>
            <p class="text-body-2 text-medium-emphasis mt-2">
              {{ filesSearch ? 'No matches for that filter.' : 'No files here.' }}
            </p>
            <v-btn
              v-if="filesPath && !filesSearch"
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
              v-if="filesPath && !filesSearch"
              prepend-icon="arrow_upward"
              title=".."
              @click="navigateFilesTo(parentPathOf(filesPath))"
            />
            <v-list-item
              v-for="d in filteredDirs"
              :key="`d:${d.path}`"
              prepend-icon="folder"
              :title="leafName(d.path)"
              @click="navigateFilesTo(d.path)"
            >
              <template #append>
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  title="Delete folder"
                  @click.stop="deleteFile(d.path)"
                >
                  <v-icon size="18">delete_outline</v-icon>
                </v-btn>
              </template>
            </v-list-item>
            <v-list-item
              v-for="f in filteredFiles"
              :key="`f:${f.path}`"
              prepend-icon="insert_drive_file"
              :title="leafName(f.path)"
              :subtitle="fileSubtitle(f)"
            >
              <template #append>
                <v-btn
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

        <!-- New-folder inline dialog. Local v-dialog instead of opening a
             global one — keeps the flow scoped to this tab and the
             cancel/close behaviour predictable. -->
        <v-dialog v-model="newFolderOpen" max-width="360">
          <v-card>
            <v-card-title class="text-subtitle-1">Create folder</v-card-title>
            <v-card-text>
              <v-text-field
                v-model="newFolderName"
                label="Folder name"
                density="compact"
                autofocus
                @keyup.enter="createNewFolder"
              />
              <p class="text-caption text-medium-emphasis">
                Created under {{ filesPath || 'root' }}
              </p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="newFolderOpen = false">Cancel</v-btn>
              <v-btn
                color="primary"
                variant="tonal"
                :disabled="!newFolderName.trim()"
                :loading="newFolderSubmitting"
                @click="createNewFolder"
              >
                Create
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
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

      <!-- ========== CAMERAS ========== -->
      <v-tabs-window-item value="cameras">
        <div class="pa-3">
          <div v-if="camerasLoading" class="pdv-empty">
            <v-progress-circular indeterminate size="24" />
          </div>
          <div v-else-if="cameras.length === 0" class="pdv-empty">
            <v-icon size="48" color="medium-emphasis">videocam_off</v-icon>
            <p class="text-body-2 text-medium-emphasis mt-2">
              No cameras configured for this printer.
            </p>
            <v-btn
              class="mt-2"
              size="small"
              variant="text"
              prepend-icon="settings"
              to="/cameras"
            >
              Manage cameras
            </v-btn>
          </div>
          <v-row v-else dense>
            <v-col v-for="cam in cameras" :key="cam.id" cols="12" md="6">
              <v-card variant="tonal" class="pdv-card">
                <v-card-title class="text-subtitle-1 d-flex align-center">
                  <v-icon class="mr-2" color="primary">videocam</v-icon>
                  {{ cam.name || `Camera ${cam.id}` }}
                  <v-spacer />
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    title="Refresh stream"
                    @click="bumpCamRefresh(cam.id!)"
                  >
                    <v-icon size="16">refresh</v-icon>
                  </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text class="pa-2">
                  <div
                    class="pdv-cam"
                    :style="{
                      aspectRatio: cam.aspectRatio || '16 / 9',
                      transform: cameraTransform(cam),
                    }"
                  >
                    <img
                      :src="cameraStreamSrc(cam)"
                      alt="camera stream"
                      class="pdv-cam__img"
                      @error="onCamLoadError(cam.id!)"
                    >
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>
      </v-tabs-window-item>

      <!-- ========== SETTINGS ========== -->
      <v-tabs-window-item value="settings">
        <div class="pa-3">
          <v-row dense>
            <v-col cols="12" md="7">
              <!-- Editable form. Mirrors AddOrUpdatePrinterDialog field-
                   for-field; submitting calls the same updatePrinter
                   endpoint with `forceSave=false`. We don't try to inline
                   the test/check panel — that's still one click away via
                   "Edit in dialog" below. -->
              <v-card variant="tonal" class="pdv-card">
                <v-card-title class="text-subtitle-1 d-flex align-center">
                  <v-icon class="mr-2" color="primary">tune</v-icon>
                  Printer configuration
                  <v-spacer />
                  <v-btn
                    size="small"
                    variant="text"
                    prepend-icon="open_in_full"
                    title="Open in the full edit dialog (test connection, force save, duplicate)"
                    @click="openEditDialog"
                  >
                    Advanced
                  </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <v-text-field
                    v-model="settingsForm.name"
                    label="Name"
                    density="compact"
                    class="mb-2"
                  />
                  <v-text-field
                    v-model="settingsForm.printerURL"
                    label="URL"
                    hint="e.g. http://192.168.187.29"
                    persistent-hint
                    density="compact"
                    class="mb-2"
                  />
                  <v-row dense>
                    <v-col cols="6">
                      <v-text-field
                        v-model="settingsForm.username"
                        label="Username"
                        autocomplete="username"
                        density="compact"
                      />
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="settingsForm.password"
                        label="Password"
                        type="password"
                        autocomplete="current-password"
                        density="compact"
                      />
                    </v-col>
                  </v-row>
                  <v-switch
                    v-model="settingsForm.enabled"
                    label="Enabled"
                    color="primary"
                    density="compact"
                    hide-details
                    class="mt-1"
                  />
                  <div class="d-flex mt-3">
                    <v-btn
                      variant="text"
                      :disabled="!settingsDirty || settingsSaving"
                      @click="resetSettingsForm"
                    >
                      Discard changes
                    </v-btn>
                    <v-spacer />
                    <v-btn
                      color="primary"
                      :disabled="!settingsDirty"
                      :loading="settingsSaving"
                      @click="saveSettings"
                    >
                      Save
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="12" md="5">
              <v-card variant="tonal" class="pdv-card">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" color="primary">memory</v-icon>
                  Runtime
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <dl class="pdv-info">
                    <dt>Type</dt><dd>{{ printerTypeLabel }}</dd>
                    <dt>Socket</dt><dd>{{ socketStateText }}</dd>
                    <dt>API</dt><dd>{{ apiStateText }}</dd>
                    <dt>State</dt><dd>{{ printerState?.text ?? '—' }}</dd>
                    <dt>Last update</dt>
                    <dd :title="lastSeenIso ?? ''">{{ lastSeenLabel }}</dd>
                    <dt v-if="printer.disabledReason">Reason</dt>
                    <dd v-if="printer.disabledReason">{{ printer.disabledReason }}</dd>
                    <dt>Created</dt>
                    <dd>{{ formatDateOrDash(printer.dateAdded ? new Date(printer.dateAdded) : null) }}</dd>
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
import { PrintersService } from '@/backend/printers.service'
import { CameraStreamService } from '@/backend/camera-stream.service'
import type { CameraStream } from '@/models/camera-streams/camera-stream'
import type { CreatePrinter } from '@/models/printers/create-printer.model'
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

type TabName = 'overview' | 'files' | 'history' | 'maintenance' | 'cameras' | 'settings'
const TAB_NAMES: TabName[] = ['overview', 'files', 'history', 'maintenance', 'cameras', 'settings']
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
  // Re-sync the form with whatever the dialog left behind on save.
  resetSettingsForm()
}

// ── Settings form (inline edit) ──
interface SettingsFormShape {
  name: string
  printerURL: string
  username: string
  password: string
  enabled: boolean
}
// Initialise the ref with safe empty values; the watcher on `printer`
// (further down) re-syncs it once the store hands us the real data.
// Doing it eagerly here would TDZ — `printer` is declared after this
// block in the setup script, and `buildFormFromPrinter()` reads it.
const settingsForm = ref<SettingsFormShape>({
  name: '',
  printerURL: '',
  // `password` and `username` are write-mostly server-side — the GET
  // returns them masked / not at all. Start empty and let the operator
  // re-enter when they actually want to change them.
  username: '',
  password: '',
  enabled: true,
})
const settingsSaving = ref(false)

function buildFormFromPrinter(): SettingsFormShape {
  return {
    name: printer.value?.name ?? '',
    printerURL: printer.value?.printerURL ?? '',
    username: '',
    password: '',
    enabled: printer.value?.enabled ?? true,
  }
}

const settingsDirty = computed(() => {
  if (!printer.value) return false
  return (
    settingsForm.value.name !== (printer.value.name ?? '') ||
    settingsForm.value.printerURL !== (printer.value.printerURL ?? '') ||
    settingsForm.value.enabled !== (printer.value.enabled ?? true) ||
    settingsForm.value.username !== '' ||
    settingsForm.value.password !== ''
  )
})

function resetSettingsForm() {
  settingsForm.value = buildFormFromPrinter()
}

async function saveSettings() {
  if (!printer.value || !props.printerId) return
  settingsSaving.value = true
  try {
    // `updatePrinter` wants the full CreatePrinter shape. Carry forward
    // whatever the store already knows about the printer (type / api
    // key) so we don't accidentally clear those server-side.
    const payload: CreatePrinter = {
      id: printer.value.id,
      name: settingsForm.value.name.trim(),
      printerURL: settingsForm.value.printerURL.trim(),
      // Empty strings mean "leave existing creds alone" on the backend
      // shape used by AddOrUpdatePrinterDialog. Re-validate by hand if
      // you want to actively clear credentials — use the full dialog.
      username: settingsForm.value.username,
      password: settingsForm.value.password,
      apiKey: (printer.value as { apiKey?: string }).apiKey ?? '',
      printerType: printer.value.printerType ?? 0,
      enabled: settingsForm.value.enabled,
    }
    await PrintersService.updatePrinter(props.printerId, payload, false)
    snackbar.openInfoMessage({ title: 'Printer updated', subtitle: payload.name })
    resetSettingsForm()
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not save changes',
      subtitle: e?.message ?? 'Unknown error',
    })
  } finally {
    settingsSaving.value = false
  }
}

// Initial-seed flag is declared up here so the watcher below (which lives
// after `printer` is declared, to dodge TDZ from `immediate: true`) can
// flip it on first fire.
let settingsFormSeeded = false

// ── Printer + live state ──
const printer = computed(() => printerStore.printer(props.printerId))
const printerEvents = computed(() => printerStateStore.printerEventsById[props.printerId])
const socketState = computed(() => printerStateStore.socketStatesById[props.printerId])

// Settings form seed watcher — has to live AFTER `printer` is declared
// because `{ immediate: true }` fires the source function during setup,
// and that source reads `printer.value`. Declaring it earlier hit TDZ.
watch(
  () => printer.value,
  (next) => {
    if (!next) return
    if (!settingsFormSeeded) {
      resetSettingsForm()
      settingsFormSeeded = true
      return
    }
    if (!settingsDirty.value) resetSettingsForm()
  },
  { deep: true, immediate: true },
)
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

// ── Files (printer USB) ──
const filesPath = ref<string>('')
const filesData = ref<FilesDto | null>(null)
const filesLoading = ref(false)
const filesSearch = ref('')
const filesInputRef = ref<HTMLInputElement | null>(null)
const filesUploading = ref(false)
const newFolderOpen = ref(false)
const newFolderName = ref('')
const newFolderSubmitting = ref(false)

const filesBreadcrumb = computed(() =>
  filesPath.value ? filesPath.value.split('/').filter(Boolean) : [],
)

// Client-side filter. The PrusaLink list endpoint doesn't take a
// `search=` param, and the listings we deal with are small enough that
// a full-rerender filter is cheaper than a round-trip per keystroke.
function matchesSearch(name: string): boolean {
  if (!filesSearch.value) return true
  return name.toLowerCase().includes(filesSearch.value.toLowerCase())
}
const filteredDirs = computed(() => (filesData.value?.dirs ?? []).filter((d) => matchesSearch(leafName(d.path))))
const filteredFiles = computed(() => (filesData.value?.files ?? []).filter((f) => matchesSearch(leafName(f.path))))

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
    const data = await PrinterRemoteFileService.getFiles(
      props.printerId,
      false,
      filesPath.value || undefined,
    )
    filesData.value = data
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

async function onFilesPicked(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset the input value so re-selecting the same file fires `change` again.
  if (input) input.value = ''
  if (!file || !printer.value) return
  filesUploading.value = true
  try {
    await PrinterRemoteFileService.uploadFile(printer.value, file, false)
    snackbar.openInfoMessage({
      title: 'Upload complete',
      subtitle: file.name,
    })
    await loadFiles()
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Upload failed',
      subtitle: e?.message ?? 'Unknown error',
    })
  } finally {
    filesUploading.value = false
  }
}

async function createNewFolder() {
  if (!props.printerId || !newFolderName.value.trim()) return
  newFolderSubmitting.value = true
  try {
    // Compose relative path. Slashes in the name are sanitised — folder
    // hierarchy should be created by navigating + creating one level
    // at a time, not by smuggling a path through the name field.
    const safe = newFolderName.value.trim().replace(/[\\/]+/g, '_')
    const fullPath = filesPath.value ? `${filesPath.value}/${safe}` : safe
    await PrinterRemoteFileService.createFolder(props.printerId, fullPath)
    snackbar.openInfoMessage({ title: 'Folder created', subtitle: safe })
    newFolderOpen.value = false
    newFolderName.value = ''
    await loadFiles()
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not create folder',
      subtitle: e?.message ?? 'Unknown error',
    })
  } finally {
    newFolderSubmitting.value = false
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


// ── Cameras (filter the global list down to this printer) ──
const cameras = ref<CameraStream[]>([])
const camerasLoading = ref(false)
// Bumps the cache-buster on the stream URL so the user can force a
// reload — handy when an MJPEG stream stalls and clears with a
// "refresh stream" click instead of a hard page reload.
const camRefresh = ref<Record<number, number>>({})

async function loadCameras() {
  if (!props.printerId) return
  camerasLoading.value = true
  try {
    const all = await CameraStreamService.listCameraStreams()
    cameras.value = (all ?? []).filter((c) => c.printerId === props.printerId)
  } catch (e: any) {
    snackbar.openErrorMessage({
      title: 'Could not load cameras',
      subtitle: e?.message ?? 'Unknown error',
    })
    cameras.value = []
  } finally {
    camerasLoading.value = false
  }
}

function cameraStreamSrc(cam: CameraStream): string {
  const base = cam.streamURL
  const stamp = cam.id ? camRefresh.value[cam.id] : 0
  if (!stamp) return base
  // Append a cache-busting param. Handles both bare URLs and ones that
  // already carry a query string.
  return base + (base.includes('?') ? '&' : '?') + `_r=${stamp}`
}

function cameraTransform(cam: CameraStream): string {
  const parts: string[] = []
  if (cam.rotationClockwise) parts.push(`rotate(${cam.rotationClockwise}deg)`)
  if (cam.flipHorizontal) parts.push('scaleX(-1)')
  if (cam.flipVertical) parts.push('scaleY(-1)')
  return parts.join(' ')
}

function bumpCamRefresh(id: number) {
  camRefresh.value = { ...camRefresh.value, [id]: Date.now() }
}

function onCamLoadError(id: number) {
  // Just log — the broken-image icon in the browser is enough of a
  // visual cue. Toasting on every camera error would spam if the
  // network's flaky.
  // eslint-disable-next-line no-console
  console.warn(`[cameras] stream failed to load for camera ${id}`)
}

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
    void loadCameras()
  },
  { immediate: true },
)
// Refresh on tab entry so a stale snapshot doesn't outlive a context
// switch. Cameras are loaded up-front (so the tab can appear/disappear
// based on count) but re-fetched on entry to recover from stale streams.
watch(
  tab,
  (next) => {
    if (next === 'overview') void loadQueue()
    if (next === 'maintenance') void loadMaintenance()
    if (next === 'files') void loadFiles()
    if (next === 'cameras') void loadCameras()
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

.pdv-files-crumbs {
  font-size: 13px;
}

.pdv-cam {
  width: 100%;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}

.pdv-cam__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
