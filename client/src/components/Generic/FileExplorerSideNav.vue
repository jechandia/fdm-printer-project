<template>
  <v-navigation-drawer
    :model-value="drawerOpened"
    location="right"
    temporary
    width="620"
    class="printer-side-nav"
    @update:model-value="closeDrawer"
  >
    <template v-if="storedSideNavPrinter">
      <!-- Sticky compact header -->
      <header class="ps-header">
        <div class="ps-header__row">
          <v-avatar
            :color="getStatusColor()"
            size="40"
            class="ps-header__avatar"
          >
            <span class="text-subtitle-2 font-weight-bold">{{ avatarInitials() }}</span>
          </v-avatar>

          <div class="ps-header__title">
            <div class="d-flex align-center ga-2 min-width-0">
              <span
                class="text-subtitle-1 font-weight-bold text-truncate"
                :title="storedSideNavPrinter.name"
              >
                {{ storedSideNavPrinter.name }}
              </span>
              <v-chip
                :color="getStatusColor()"
                :prepend-icon="getStatusIcon()"
                size="x-small"
                variant="tonal"
                class="font-weight-medium flex-shrink-0"
              >
                {{ getStatusText() }}
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ serviceName }}
            </div>
          </div>

          <div class="ps-header__actions">
            <v-btn
              v-if="hasWebInterface(storedSideNavPrinter.printerType)"
              icon="open_in_new"
              variant="text"
              size="small"
              density="comfortable"
              @click="openPrinterURL()"
            >
              <v-icon>open_in_new</v-icon>
              <v-tooltip activator="parent" location="bottom">Open web UI</v-tooltip>
            </v-btn>
            <v-btn
              icon
              variant="text"
              size="small"
              density="comfortable"
              @click="closeDrawer()"
            >
              <v-icon>close</v-icon>
              <v-tooltip activator="parent" location="bottom">Close</v-tooltip>
            </v-btn>
          </div>
        </div>

        <!-- Inline progress strip when printing -->
        <div
          v-if="currentJob?.progress && isPrinting"
          class="ps-header__progress"
        >
          <div class="d-flex justify-space-between align-center mb-1 ga-2">
            <span
              class="text-caption text-medium-emphasis text-truncate"
              :title="currentPrintingFilePath"
            >
              {{ currentPrintingFilePath }}
            </span>
            <span class="text-caption font-weight-bold flex-shrink-0">
              {{ truncateProgress(currentJob.progress.completion) }}%
            </span>
          </div>
          <v-progress-linear
            :model-value="currentJob.progress.completion"
            color="primary"
            height="4"
            rounded
          />
        </div>
      </header>

      <!-- Action toolbar -->
      <div class="ps-toolbar">
        <!-- Print Controls — emphasized when active -->
        <template v-if="isPrinting || isPaused">
          <v-btn
            :disabled="!isOnline"
            :color="isPaused ? 'success' : 'warning'"
            size="small"
            variant="flat"
            :prepend-icon="isPaused ? 'play_arrow' : 'pause'"
            @click="isPaused ? clickResumePrint() : clickPausePrint()"
          >
            {{ isPaused ? 'Resume' : 'Pause' }}
          </v-btn>
        </template>
        <v-btn
          v-if="isStoppable"
          color="error"
          size="small"
          variant="flat"
          prepend-icon="stop"
          @click="clickStopPrint()"
        >
          Cancel
        </v-btn>

        <v-divider
          v-if="isPrinting || isPaused || isStoppable"
          vertical
          class="mx-1"
        />

        <!-- Connection / lifecycle — icon-only with tooltips -->
        <v-btn
          :disabled="!isEnabled || !isOnline"
          :color="isOperational ? 'warning' : 'success'"
          variant="text"
          size="small"
          density="comfortable"
          icon
          @click="togglePrinterConnection()"
        >
          <v-icon>{{ isOperational ? 'usb_off' : 'usb' }}</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ isOperational ? 'Disconnect' : 'Connect' }}
          </v-tooltip>
        </v-btn>

        <v-btn
          :color="isEnabled ? 'default' : 'success'"
          variant="text"
          size="small"
          density="comfortable"
          icon
          @click="toggleEnabled()"
        >
          <v-icon>{{ isEnabled ? 'toggle_on' : 'toggle_off' }}</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ isEnabled ? 'Disable' : 'Enable' }}
          </v-tooltip>
        </v-btn>

        <v-btn
          variant="text"
          size="small"
          density="comfortable"
          icon
          @click="refreshSocketState()"
        >
          <v-icon>refresh</v-icon>
          <v-tooltip activator="parent" location="bottom">Refresh connection</v-tooltip>
        </v-btn>

        <v-btn
          :color="isUnderMaintenance ? 'warning' : undefined"
          variant="text"
          size="small"
          density="comfortable"
          icon
          @click="toggleMaintenance()"
        >
          <v-icon>{{ isUnderMaintenance ? 'build_circle' : 'build' }}</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ isUnderMaintenance ? 'End maintenance' : 'Start maintenance' }}
          </v-tooltip>
        </v-btn>

        <v-btn
          variant="text"
          size="small"
          density="comfortable"
          icon
          @click="clickSettings()"
        >
          <v-icon>settings</v-icon>
          <v-tooltip activator="parent" location="bottom">Settings</v-tooltip>
        </v-btn>
      </div>

      <!-- Compact status alerts (only what's relevant) -->
      <div
        v-if="printerAttention.needsAttention || (!isEnabled) || fileLoadError"
        class="ps-alerts"
      >
        <!-- The unified attention alert (ATTENTION, error, maintenance,
             auth-fail, disconnected, paused). Severity drives the colour
             and the badge so the user reads urgency at a glance. -->
        <v-alert
          v-if="printerAttention.needsAttention"
          :type="attentionAlertType"
          :icon="printerAttention.icon"
          variant="tonal"
          density="compact"
          :class="['ps-attention', `ps-attention--${printerAttention.severity}`]"
        >
          <div class="font-weight-bold">{{ printerAttention.title }}</div>
          <div class="text-body-2">{{ printerAttention.message }}</div>
          <div
            v-if="printerAttention.hint"
            class="text-caption text-medium-emphasis mt-1"
          >
            {{ printerAttention.hint }}
          </div>
        </v-alert>

        <v-alert
          v-if="!isEnabled && !storedSideNavPrinter?.disabledReason"
          type="warning"
          variant="tonal"
          density="compact"
          icon="power_off"
        >
          Printer is disabled. Enable to receive live updates.
        </v-alert>

        <v-alert
          v-if="fileLoadError"
          type="warning"
          variant="tonal"
          density="compact"
          icon="warning"
        >
          <div class="d-flex align-center justify-space-between ga-2">
            <span>Unable to load files from {{ serviceName }}</span>
            <v-btn
              size="x-small"
              variant="outlined"
              @click="refreshFiles()"
            >
              Retry
            </v-btn>
          </div>
        </v-alert>
      </div>

      <!-- Per-printer queue section -->
      <section class="ps-queue">
        <div class="ps-queue__header">
          <span class="text-subtitle-2 font-weight-bold">Queue</span>
          <v-chip
            v-if="queueItems.length > 0"
            size="x-small"
            color="primary"
            variant="tonal"
            class="ml-2"
          >
            {{ queueItems.length }}
          </v-chip>
          <v-chip
            v-if="queueTotalSeconds > 0"
            size="x-small"
            variant="tonal"
            prepend-icon="schedule"
            class="ml-1"
            :title="`${queueTotalSeconds.toLocaleString()} seconds queued`"
          >
            ~{{ formatQueueDuration(queueTotalSeconds) }}
          </v-chip>
          <v-spacer />
          <v-btn
            v-if="queueItems.length > 0"
            size="x-small"
            variant="tonal"
            color="success"
            prepend-icon="play_arrow"
            :disabled="!isOnline || !isOperational || queueProcessing"
            :loading="queueProcessing"
            @click="processNextInQueue()"
          >
            Process next
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="x-small"
            density="comfortable"
            @click="loadQueue()"
          >
            <v-icon>refresh</v-icon>
            <v-tooltip activator="parent" location="bottom">Refresh queue</v-tooltip>
          </v-btn>
          <v-btn
            v-if="queueItems.length > 0"
            icon
            variant="text"
            size="x-small"
            density="comfortable"
            @click="clickClearQueue()"
          >
            <v-icon color="error">delete_sweep</v-icon>
            <v-tooltip activator="parent" location="bottom">Clear queue</v-tooltip>
          </v-btn>
        </div>

        <div
          v-if="queueItems.length === 0"
          class="ps-queue__empty"
        >
          <v-icon size="small" class="mr-2">inbox</v-icon>
          Queue is empty. Add jobs from the global Print Jobs view.
        </div>

        <!-- Hero card for the next-to-print job. Shows the same drag
             handle / remove button as the rest of the queue, but with
             a bigger thumbnail and richer metadata so the operator
             knows what's about to happen on the printer. -->
        <article
          v-if="queueItems.length > 0"
          class="ps-queue__hero"
          :class="{
            'ps-queue__hero--dragging': draggingIndex === 0,
            'ps-queue__hero--drop-target': dragOverIndex === 0 && draggingIndex !== null && draggingIndex > 0,
          }"
          draggable="true"
          @dragstart="onQueueDragStart(0, $event)"
          @dragover.prevent="onQueueDragOver(0)"
          @dragleave="onQueueDragLeave(0)"
          @drop.prevent="onQueueDrop(0)"
          @dragend="onQueueDragEnd()"
        >
          <div class="ps-queue__hero-label">
            <v-icon size="x-small">north_east</v-icon>
            Next up
          </div>
          <div class="ps-queue__hero-body">
            <div class="ps-queue__hero-thumb">
              <FileThumbnailCell
                v-if="queueItems[0].fileStorageId"
                :file-storage-id="queueItems[0].fileStorageId"
                :thumbnails="(queueItems[0].thumbnails as any) || []"
              />
              <img
                v-else-if="nextUpUsbThumbnail"
                :src="nextUpUsbThumbnail"
                alt="Firmware thumbnail"
                class="ps-queue__hero-thumb-img"
              />
              <v-progress-circular
                v-else-if="nextUpUsbThumbnailLoading"
                indeterminate
                size="22"
                width="2"
              />
              <v-icon
                v-else
                size="40"
                color="medium-emphasis"
              >
                insert_drive_file
              </v-icon>
            </div>
            <div class="ps-queue__hero-info">
              <div
                class="ps-queue__hero-name"
                :title="displayFileName(queueItems[0])"
              >
                {{ displayFileName(queueItems[0]) }}
              </div>
              <div class="ps-queue__hero-meta">
                <v-chip
                  :color="queueStatusColor(queueItems[0].status)"
                  size="x-small"
                  variant="tonal"
                  density="comfortable"
                >
                  {{ queueItems[0].status }}
                </v-chip>
                <span
                  v-if="queueItems[0].fileFormat"
                  class="text-caption text-medium-emphasis"
                >
                  {{ queueItems[0].fileFormat.toUpperCase() }}
                </span>
                <span
                  v-if="queueItems[0].fileSize"
                  class="text-caption text-medium-emphasis"
                >
                  · {{ formatHeroFileSize(queueItems[0].fileSize) }}
                </span>
              </div>
              <div class="ps-queue__hero-stats">
                <div v-if="queueItems[0].estimatedTimeSeconds" class="ps-queue__hero-stat">
                  <v-icon size="x-small">schedule</v-icon>
                  <span>~{{ formatQueueDuration(queueItems[0].estimatedTimeSeconds) }}</span>
                </div>
                <div v-if="formatFilamentGrams(queueItems[0].filamentGrams)" class="ps-queue__hero-stat">
                  <v-icon size="x-small">fitness_center</v-icon>
                  <span>{{ formatFilamentGrams(queueItems[0].filamentGrams) }}</span>
                </div>
                <div v-if="queueItems[0].totalLayers" class="ps-queue__hero-stat">
                  <v-icon size="x-small">layers</v-icon>
                  <span>{{ queueItems[0].totalLayers }} layers</span>
                </div>
                <div v-if="queueItems[0].layerHeight" class="ps-queue__hero-stat">
                  <v-icon size="x-small">straighten</v-icon>
                  <span>{{ queueItems[0].layerHeight }}mm</span>
                </div>
                <div v-if="queueItems[0].filamentType" class="ps-queue__hero-stat">
                  <v-icon size="x-small">science</v-icon>
                  <span>{{ formatFilamentType(queueItems[0].filamentType) }}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="ps-queue__remove ps-queue__remove--hero"
              aria-label="Remove from queue"
              @click="removeFromQueue(queueItems[0])"
            >
              <v-icon size="18">close</v-icon>
            </button>
          </div>
        </article>

        <ul
          v-if="queueItems.length > 1"
          class="ps-queue__list"
          @dragover.prevent
        >
          <li
            v-for="(job, idx) in queueItems.slice(1)"
            :key="job.id"
            class="ps-queue__item"
            :class="{
              'ps-queue__item--dragging': draggingIndex === idx + 1,
              'ps-queue__item--drop-above': dragOverIndex === idx + 1 && draggingIndex !== null && draggingIndex > idx + 1,
              'ps-queue__item--drop-below': dragOverIndex === idx + 1 && draggingIndex !== null && draggingIndex < idx + 1,
            }"
            draggable="true"
            @dragstart="onQueueDragStart(idx + 1, $event)"
            @dragover.prevent="onQueueDragOver(idx + 1)"
            @dragleave="onQueueDragLeave(idx + 1)"
            @drop.prevent="onQueueDrop(idx + 1)"
            @dragend="onQueueDragEnd()"
          >
            <v-icon
              size="small"
              class="ps-queue__handle"
              title="Drag to reorder"
            >
              drag_indicator
            </v-icon>
            <span class="ps-queue__position">{{ idx + 2 }}</span>
            <div class="ps-queue__body">
              <div
                class="ps-queue__name text-body-2 text-truncate"
                :title="displayFileName(job)"
              >
                {{ displayFileName(job) }}
              </div>
              <div class="ps-queue__meta">
                <v-chip
                  :color="queueStatusColor(job.status)"
                  size="x-small"
                  variant="tonal"
                  density="comfortable"
                >
                  {{ job.status }}
                </v-chip>
                <span
                  v-if="job.estimatedTimeSeconds"
                  class="text-caption text-medium-emphasis"
                >
                  Est. {{ formatQueueDuration(job.estimatedTimeSeconds) }}
                </span>
              </div>
            </div>
            <button
              type="button"
              class="ps-queue__remove"
              aria-label="Remove from queue"
              @click="removeFromQueue(job)"
            >
              <v-icon size="16">close</v-icon>
            </button>
          </li>
        </ul>
      </section>

      <!-- Files section -->
      <section class="ps-files">
        <!-- Source tabs: Storage (primary) / USB (secondary) -->
        <div class="ps-files__source-tabs">
          <v-btn-toggle
            v-model="filesSource"
            mandatory
            density="compact"
            divided
            color="primary"
          >
            <v-btn value="storage" size="small">
              <v-icon start size="small">inventory_2</v-icon>
              Storage
            </v-btn>
            <v-btn value="usb" size="small">
              <v-icon start size="small">usb</v-icon>
              USB
            </v-btn>
          </v-btn-toggle>
        </div>

        <!-- ── USB (existing behaviour) ─────────────────────── -->
        <template v-if="filesSource === 'usb'">
          <div class="ps-files__toolbar">
            <div class="ps-breadcrumb">
              <v-btn
                size="x-small"
                variant="text"
                :disabled="breadcrumbParts.length === 0"
                prepend-icon="home"
                @click="fileExplorer.setCurrentPath(''); refreshFiles()"
              >
                Root
              </v-btn>
              <template
                v-for="(part, index) in breadcrumbParts"
                :key="index"
              >
                <v-icon size="x-small" class="text-medium-emphasis">chevron_right</v-icon>
                <v-btn
                  size="x-small"
                  variant="text"
                  @click="navigateToBreadcrumb(index)"
                >
                  {{ part }}
                </v-btn>
              </template>
            </div>
            <v-spacer />

            <input
              ref="drawerUploadInput"
              type="file"
              multiple
              accept=".gcode,.3mf,.bgcode"
              style="display: none"
              @change="onDrawerFilesSelected"
            />
            <v-btn
              size="x-small"
              variant="tonal"
              color="primary"
              prepend-icon="upload"
              :disabled="!storedSideNavPrinter || !isOnline"
              @click="triggerDrawerUpload()"
            >
              Upload
              <v-tooltip activator="parent" location="bottom">
                Upload one or more files (drag onto the drawer to bulk-upload too).
                Use the queue to start printing.
              </v-tooltip>
            </v-btn>

            <v-btn
              icon
              variant="text"
              size="x-small"
              density="comfortable"
              :disabled="creatingFolder"
              @click="clickCreateFolder()"
            >
              <v-icon>create_new_folder</v-icon>
              <v-tooltip activator="parent" location="bottom">New folder</v-tooltip>
            </v-btn>
            <v-btn
              icon
              variant="text"
              size="x-small"
              density="comfortable"
              @click="refreshFiles()"
            >
              <v-icon>refresh</v-icon>
              <v-tooltip activator="parent" location="bottom">Refresh files</v-tooltip>
            </v-btn>
          </div>

        <v-text-field
          v-model="fileSearch"
          placeholder="Search files…"
          prepend-inner-icon="search"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          class="ps-files__search"
        />

        <div class="ps-files__list">
          <div
            v-if="loading"
            class="d-flex justify-center py-6"
          >
            <v-progress-circular indeterminate size="28" />
          </div>

          <div
            v-else-if="!filesListed.length && !fileLoadError"
            class="text-center py-10 text-medium-emphasis"
          >
            <v-icon size="40" class="mb-2">folder_open</v-icon>
            <div class="text-body-2">No files found</div>
          </div>

          <v-list
            v-else
            density="compact"
            class="ps-files__items pa-0"
            bg-color="transparent"
          >
            <template
              v-for="(item, index) in fileTree"
              :key="item.id"
            >
              <v-divider v-if="index > 0" />
              <v-list-item
                density="compact"
                :class="['ps-file-item', { 'ps-file-item--folder': item.type === 'folder' }]"
                @click="item.type === 'folder' ? navigateToDir(item.path) : undefined"
              >
                <template #prepend>
                  <v-icon
                    :color="item.type === 'file' && item.file && isFileBeingPrinted(item.file) ? 'primary' : 'medium-emphasis'"
                  >
                    {{ getTreeIcon(item) }}
                  </v-icon>
                </template>

                <v-list-item-title class="text-body-2">
                  <span
                    :class="{ 'text-primary font-weight-bold': item.type === 'file' && item.file && isFileBeingPrinted(item.file) }"
                    :title="item.path"
                  >
                    {{ item.name }}
                  </span>
                </v-list-item-title>

                <v-list-item-subtitle
                  v-if="item.type === 'file' && item.file"
                  class="text-caption"
                >
                  {{ formatFileSize(item.file.size ?? undefined) }}
                </v-list-item-subtitle>

                <template #append>
                  <div
                    v-if="item.type === 'file' && item.file"
                    class="d-flex ga-1 ps-file-item__actions"
                    @click.stop
                  >
                    <v-btn
                      icon
                      size="x-small"
                      variant="text"
                      density="comfortable"
                      @click="clickDownloadFile(item.file.path)"
                    >
                      <v-icon size="small">download</v-icon>
                      <v-tooltip activator="parent" location="bottom">Download</v-tooltip>
                    </v-btn>
                    <v-btn
                      :disabled="isFileBeingPrinted(item.file) || enqueuingUsbPath === item.file.path"
                      icon
                      size="x-small"
                      variant="text"
                      density="comfortable"
                      color="success"
                      @click="enqueueUsbFile(item.file)"
                    >
                      <v-icon size="small">add_to_queue</v-icon>
                      <v-tooltip activator="parent" location="bottom">Add to queue</v-tooltip>
                    </v-btn>
                    <v-btn
                      :disabled="isFileBeingPrinted(item.file)"
                      icon
                      size="x-small"
                      variant="text"
                      density="comfortable"
                      color="error"
                      @click="deleteFile(item.file)"
                    >
                      <v-icon size="small">delete</v-icon>
                      <v-tooltip activator="parent" location="bottom">Delete</v-tooltip>
                    </v-btn>
                  </div>
                </template>
              </v-list-item>
            </template>
          </v-list>
        </div>
        </template>

        <!-- ── Storage (File Storage, filtered by printer compat) ─── -->
        <template v-else>
          <div class="ps-files__toolbar">
            <div class="ps-breadcrumb">
              <v-btn
                size="x-small"
                variant="text"
                :disabled="storageFolderPath === null"
                prepend-icon="home"
                @click="navigateStorageTo(null)"
              >
                Root
              </v-btn>
              <template
                v-for="(crumb, idx) in storageBreadcrumb"
                :key="crumb.path"
              >
                <v-icon size="x-small" class="text-medium-emphasis">chevron_right</v-icon>
                <v-btn
                  size="x-small"
                  variant="text"
                  :disabled="idx === storageBreadcrumb.length - 1"
                  @click="navigateStorageTo(crumb.path)"
                >
                  {{ crumb.name }}
                </v-btn>
              </template>
            </div>
            <v-spacer />
            <v-btn
              icon
              variant="text"
              size="x-small"
              density="comfortable"
              @click="loadStorage()"
            >
              <v-icon>refresh</v-icon>
              <v-tooltip activator="parent" location="bottom">Refresh</v-tooltip>
            </v-btn>
          </div>

          <v-text-field
            v-model="storageSearch"
            placeholder="Search files…"
            prepend-inner-icon="search"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            class="ps-files__search"
          />

          <v-alert
            v-if="storageIncompatibleCount > 0"
            type="info"
            variant="tonal"
            density="compact"
            icon="info"
            class="mb-2"
          >
            {{ storageIncompatibleCount }}
            {{ storageIncompatibleCount === 1 ? 'file' : 'files' }}
            hidden — incompatible with this printer.
          </v-alert>

          <div class="ps-files__list">
            <div
              v-if="storageLoading"
              class="d-flex justify-center py-6"
            >
              <v-progress-circular indeterminate size="28" />
            </div>

            <div
              v-else-if="!storageFolders.length && !filteredStorageFiles.length"
              class="text-center py-10 text-medium-emphasis"
            >
              <v-icon size="40" class="mb-2">folder_open</v-icon>
              <div class="text-body-2">No compatible files here</div>
              <div class="text-caption">
                Upload from
                <router-link to="/files" class="text-primary">File Storage</router-link>
              </div>
            </div>

            <v-list
              v-else
              density="compact"
              class="ps-files__items pa-0"
              bg-color="transparent"
            >
              <template v-for="(item, index) in storageTree" :key="item.id">
                <v-divider v-if="index > 0" />
                <v-list-item
                  density="compact"
                  :class="['ps-file-item', { 'ps-file-item--folder': item.type === 'folder' }]"
                  @click="item.type === 'folder' ? navigateStorageTo(item.path) : undefined"
                >
                  <template #prepend>
                    <v-icon v-if="item.type === 'folder'" color="medium-emphasis">
                      folder
                    </v-icon>
                    <FileThumbnailCell
                      v-else-if="item.file"
                      :file-storage-id="item.file.fileStorageId"
                      :thumbnails="(item.file.thumbnails as any) || []"
                      class="ps-storage-thumb"
                    />
                  </template>

                  <v-list-item-title class="text-body-2">
                    <span :title="item.name">{{ item.name }}</span>
                  </v-list-item-title>

                  <v-list-item-subtitle
                    v-if="item.type === 'file' && item.file"
                    class="text-caption"
                  >
                    {{ formatFileSize(item.file.fileSize) }}
                    <span v-if="item.file.estimatedTimeSeconds">
                      · {{ formatQueueDuration(item.file.estimatedTimeSeconds) }}
                    </span>
                  </v-list-item-subtitle>

                  <template #append>
                    <div
                      v-if="item.type === 'file' && item.file"
                      class="d-flex ga-1 ps-file-item__actions"
                      @click.stop
                    >
                      <v-btn
                        icon
                        size="x-small"
                        variant="text"
                        density="comfortable"
                        color="success"
                        :disabled="enqueuingFileId === item.file.fileStorageId"
                        @click="enqueueStorageFile(item.file)"
                      >
                        <v-icon size="small">add_to_queue</v-icon>
                        <v-tooltip activator="parent" location="bottom">Add to queue</v-tooltip>
                      </v-btn>
                    </div>
                  </template>
                </v-list-item>
              </template>
            </v-list>
          </div>
        </template>
      </section>
    </template>
  </v-navigation-drawer>

  <!-- Create-folder dialog -->
  <v-dialog
    v-model="showCreateFolderDialog"
    max-width="420"
    @keydown.esc="closeCreateFolderDialog()"
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2 text-subtitle-1">
        <v-icon size="small">create_new_folder</v-icon>
        New folder
      </v-card-title>
      <v-card-text class="pb-2">
        <div
          v-if="currentPath"
          class="text-caption text-medium-emphasis mb-2 d-flex align-center ga-1"
        >
          <v-icon size="x-small">folder</v-icon>
          Inside /{{ currentPath }}
        </div>
        <v-text-field
          v-model="newFolderName"
          label="Folder name"
          placeholder="my-folder"
          variant="outlined"
          density="compact"
          autofocus
          :error-messages="newFolderError ? [newFolderError] : []"
          hide-details="auto"
          @keydown.enter.prevent="submitCreateFolder()"
          @input="newFolderError = null"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="creatingFolder"
          @click="closeCreateFolderDialog()"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="creatingFolder"
          :disabled="!newFolderName.trim()"
          @click="submitCreateFolder()"
        >
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { generateInitials } from '@/shared/noun-adjectives.data'
import { PrinterRemoteFileService, PrintersService } from '@/backend'
import {
  PrintQueueService,
  type QueuedJob,
  type AvailableFile,
  type AvailableFolder
} from '@/backend/print-queue.service'
import { PrinterMaintenanceLogService } from '@/backend/printer-maintenance-log.service'
import { FileDto } from '@/models/printers/printer-file.model'
import { formatFileSize } from '@/utils/file-size.util'
import { displayFileName } from '@/utils/file-name.util'
import FileThumbnailCell from '@/components/Files/FileThumbnailCell.vue'
import { useFirmwareThumbnailQuery } from '@/queries/firmware-thumbnail.query'
import { derivePrinterAttention } from '@/shared/printer-attention.util'
import { notifyPrintJobsChanged } from '@/shared/print-jobs-invalidator.composable'
import { confirm as confirmDialog } from '@/shared/confirm-dialog.composable'
import { usePrinterStore } from '@/store/printer.store'
import { DialogName } from './Dialogs/dialog.constants'
import { usePrinterStateStore } from '@/store/printer-state.store'
import {
  getPrinterTypeName,
} from "@/shared/printer-types.constants";
import { hasWebInterface } from '@/shared/printer-capabilities.constants'
import { useDialog } from '@/shared/dialog.composable'
import { useFileExplorer } from '@/shared/file-explorer.composable'
import { useUploadsStore } from '@/store/uploads.store'
import { useSnackbar } from '@/shared/snackbar.composable'
import { convertPrinterMultiFileToQueue } from '@/utils/uploads-state.utils'

interface TreeNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  file?: FileDto
  children?: TreeNode[]
}

const printersStore = usePrinterStore()
const printerStateStore = usePrinterStateStore()
const fileExplorer = useFileExplorer()

const fileSearch = ref<string | undefined>(undefined)
const fileList = ref<FileDto[] | undefined>(undefined)
const drawerOpened = fileExplorer.isOpen
const loading = fileExplorer.loading
const fileLoadError = fileExplorer.error
const printerId = fileExplorer.currentPrinterId
const currentPath = fileExplorer.currentPath
const creatingFolder = ref(false)
const showCreateFolderDialog = ref(false)
const newFolderName = ref('')
const newFolderError = ref<string | null>(null)

const drawerUploadInput = ref<HTMLInputElement | null>(null)
const uploadsStore = useUploadsStore()
const snackbar = useSnackbar()

const queueItems = ref<QueuedJob[]>([])
const queueProcessing = ref(false)
const queueReordering = ref(false)

// ── Files source (Storage = File Storage, USB = printer's media) ──
const filesSource = ref<'storage' | 'usb'>('storage')
const storageFolderPath = ref<string | null>(null)
const storageFolders = ref<AvailableFolder[]>([])
const storageFiles = ref<AvailableFile[]>([])
const storageIncompatibleCount = ref(0)
const storageLoading = ref(false)
const storageSearch = ref('')
const enqueuingFileId = ref<string | null>(null)
const enqueuingUsbPath = ref<string | null>(null)

const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const queueTotalSeconds = computed(() =>
  queueItems.value.reduce((acc, j) => acc + (j.estimatedTimeSeconds ?? 0), 0)
)

// ── Firmware thumbnail for the next-up USB job ────────────────
// Only triggers a fetch when the next-up job is a USB-only one
// (fileStorageId null + usbFilePath set). The query returns a data-URL
// the hero card can use as <img src>.
const nextUpUsbPath = computed(() => {
  const head = queueItems.value[0]
  if (!head) return null
  if (head.fileStorageId) return null
  return head.usbFilePath ?? null
})

const { data: nextUpUsbThumbnail, isFetching: nextUpUsbThumbnailLoading } =
  useFirmwareThumbnailQuery(printerId, nextUpUsbPath, 'big')

const storedSideNavPrinter = computed(() => {
  if (!printerId.value) return undefined
  return printersStore.printer(printerId.value)
})
const isOnline = computed(() =>
  printerId.value ? printerStateStore.isApiResponding(printerId.value) : false
)

const serviceName = computed(() =>
  getPrinterTypeName(storedSideNavPrinter.value?.printerType)
)

const isOperational = computed(() =>
  printerId.value
    ? printerStateStore.isPrinterOperational(printerId.value)
    : false
)
const isEnabled = computed(() => {
  return storedSideNavPrinter.value?.enabled
})
const isUnderMaintenance = computed(() => {
  return !!storedSideNavPrinter.value?.disabledReason?.length
})

const printerAttention = computed(() => {
  if (!printerId.value || !storedSideNavPrinter.value) {
    return derivePrinterAttention(undefined, undefined, undefined)
  }
  return derivePrinterAttention(
    storedSideNavPrinter.value,
    printerStateStore.printerEventsById[printerId.value],
    printerStateStore.socketStatesById[printerId.value],
  )
})

const attentionAlertType = computed(() => {
  switch (printerAttention.value.severity) {
    case 'critical': return 'error'
    case 'warning': return 'warning'
    default: return 'info'
  }
})
const isPrinting = computed(() => {
  return printerId.value
    ? printerStateStore.isPrinterPrinting(printerId.value)
    : false
})
const filesListed = computed(() => {
  if (!fileList.value?.length) return []
  return (
    fileList.value.filter((f) =>
      fileSearch.value?.length
        ? `${f.path}`.toLowerCase().includes(fileSearch.value)
        : true
    ) || []
  )
})

const fileTree = computed(() => {
  const items: TreeNode[] = []

  filesListed.value.forEach((file) => {
    const node: TreeNode = {
      id: file.path,
      name: file.path.split('/').pop() || file.path,
      type: file.dir ? 'folder' : 'file',
      path: file.path,
      file: file.dir ? undefined : file
    }
    items.push(node)
  })

  // Sort: folders first, then alphabetically
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return items
})
const isStoppable = computed(() => {
  if (!storedSideNavPrinter.value || !printerId.value) return false
  return printerStateStore.isPrinterStoppable(printerId.value)
})
const isPaused = computed(() => {
  if (!storedSideNavPrinter.value || !printerId.value) return false
  return printerStateStore.isPrinterPaused(printerId.value)
})
const currentJob = computed(() => {
  if (!printerId.value) {
    throw new Error('Printer ID not set, cannot get current job')
  }
  return printerStateStore.printerJobsById[printerId.value]
})
const currentPrintingFilePath = computed(() => {
  if (!printerId.value) {
    throw new Error('Printer ID not set, cannot get current printing file name')
  }
  return printerStateStore.printingFilePathsByPrinterId[printerId.value]
})
const refreshFiles = async () => {
  fileExplorer.setLoading(true)
  fileExplorer.setError(false)
  const currentPrinterId = printerId.value
  if (!currentPrinterId) return
  try {
    const startDir = currentPath.value || undefined
    fileList.value = await printersStore.loadPrinterFiles(currentPrinterId, false, startDir)
  } catch (error) {
    console.warn('Failed to load printer files:', error)
    fileExplorer.setError(true)
    fileList.value = []
  } finally {
    fileExplorer.setLoading(false)
  }
}

const navigateToDir = async (dirPath: string) => {
  fileExplorer.setCurrentPath(dirPath)
  await refreshFiles()
}

const navigateToBreadcrumb = async (index: number) => {
  const pathParts = currentPath.value.split('/').filter(p => p.length > 0)
  const newPath = pathParts.slice(0, index + 1).join('/')
  fileExplorer.setCurrentPath(newPath)
  await refreshFiles()
}

const breadcrumbParts = computed(() => {
  if (!currentPath.value) return []
  return currentPath.value.split('/').filter(p => p.length > 0)
})
const deleteFile = async (file: FileDto) => {
  if (!printerId.value) return
  const tail = file.path.split('/').filter(Boolean).pop() || file.path
  const ok = await confirmDialog({
    title: 'Delete file from the printer?',
    message: `"${tail}" will be removed from the printer's storage.`,
    hint: 'This only affects the file on the printer — copies in File Storage are kept.',
    confirmText: 'Delete file',
    severity: 'danger',
    icon: 'delete',
  })
  if (!ok) return
  await printersStore.deletePrinterFile(printerId.value, file.path)
}

function triggerDrawerUpload() {
  drawerUploadInput.value?.click()
}

async function onDrawerFilesSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? [])
  target.value = '' // allow re-uploading same file later
  if (!files.length || !storedSideNavPrinter.value) return

  // Drawer upload only stages the file on the printer. Use the queue to
  // start a print so the action is always observable from /jobs.
  const uploads = convertPrinterMultiFileToQueue(
    storedSideNavPrinter.value,
    files,
    false,
  )
  uploadsStore.queueUploads(uploads)

  snackbar.openInfoMessage({
    title: `Uploading ${files.length} file${files.length === 1 ? '' : 's'}`,
    subtitle: 'Files will appear in the USB tab. Queue them to start printing.',
  })

  // Files appear after the backend confirms the upload — give the queue a
  // moment, then refresh so the user sees the new file in the list.
  setTimeout(() => refreshFiles(), 1500)
}

function clickCreateFolder() {
  newFolderName.value = ''
  newFolderError.value = null
  showCreateFolderDialog.value = true
}

function closeCreateFolderDialog() {
  showCreateFolderDialog.value = false
  newFolderName.value = ''
  newFolderError.value = null
}

async function submitCreateFolder() {
  if (!printerId.value || creatingFolder.value) return

  const cleanName = newFolderName.value.trim().replace(/^\/+|\/+$/g, '')
  if (!cleanName) {
    newFolderError.value = 'Name is required'
    return
  }
  if (cleanName.includes('/')) {
    newFolderError.value = 'Name cannot contain a slash'
    return
  }

  const fullPath = currentPath.value
    ? `${currentPath.value.replace(/\/+$/, '')}/${cleanName}`
    : cleanName

  creatingFolder.value = true
  newFolderError.value = null
  try {
    await PrinterRemoteFileService.createFolder(printerId.value, fullPath)
    await refreshFiles()
    closeCreateFolderDialog()
  } catch (err: any) {
    newFolderError.value =
      err?.response?.data?.error ||
      err?.message ||
      'Failed to create folder'
  } finally {
    creatingFolder.value = false
  }
}

// ── Storage source (File Storage filtered by printer compatibility) ──
const storageBreadcrumb = computed(() => {
  if (!storageFolderPath.value) return []
  const segments = storageFolderPath.value.split('/').filter(Boolean)
  const acc: Array<{ path: string; name: string }> = []
  let prefix = ''
  for (const seg of segments) {
    prefix += '/' + seg
    acc.push({ path: prefix, name: seg })
  }
  return acc
})

const filteredStorageFiles = computed(() => {
  const q = storageSearch.value?.toLowerCase().trim()
  if (!q) return storageFiles.value
  return storageFiles.value.filter(f => {
    const display = displayFileName(f).toLowerCase()
    return display.includes(q) || f.fileName.toLowerCase().includes(q)
  })
})

const storageTree = computed(() => {
  const items: Array<{
    id: string
    type: 'folder' | 'file'
    name: string
    path: string
    file?: AvailableFile
  }> = []
  for (const folder of storageFolders.value) {
    items.push({ id: `dir:${folder.path}`, type: 'folder', name: folder.name, path: folder.path })
  }
  for (const file of filteredStorageFiles.value) {
    items.push({
      id: `file:${file.fileStorageId}`,
      type: 'file',
      name: displayFileName(file),
      path: file.folderPath ?? '',
      file
    })
  }
  return items
})

async function loadStorage() {
  if (!printerId.value) return
  storageLoading.value = true
  try {
    const response = await PrintQueueService.getAvailableFiles(
      printerId.value,
      storageFolderPath.value
    )
    storageFolders.value = response.folders
    storageFiles.value = response.files
    storageIncompatibleCount.value = response.incompatibleCount
  } catch (err) {
    console.warn('Failed to load storage files:', err)
    storageFolders.value = []
    storageFiles.value = []
    storageIncompatibleCount.value = 0
  } finally {
    storageLoading.value = false
  }
}

async function navigateStorageTo(path: string | null) {
  storageFolderPath.value = path
  await loadStorage()
}

async function enqueueStorageFile(file: AvailableFile) {
  if (!printerId.value || enqueuingFileId.value) return
  enqueuingFileId.value = file.fileStorageId
  try {
    const response = await PrintQueueService.createJobFromFile(
      printerId.value,
      file.fileStorageId
    )
    queueItems.value = response.queue ?? queueItems.value
    snackbar.openInfoMessage({
      title: `Queued ${displayFileName(file)}`,
      subtitle: 'Use Process next from the queue to start printing.',
    })
    await loadQueue()
    notifyPrintJobsChanged({ printerId: printerId.value, reason: 'storage:enqueue' })
  } catch (err: any) {
    console.error('Failed to enqueue:', err)
    snackbar.openErrorMessage({
      title: 'Failed to enqueue',
      subtitle: err?.response?.data?.error || err?.message || ''
    })
  } finally {
    enqueuingFileId.value = null
  }
}

/**
 * Enqueue a file that lives on the printer's USB storage (not in File
 * Storage). The PrusaLink adapter already surfaces the long display
 * name inside `path`, so passing it as both filePath and displayName
 * gives the backend something friendly to persist on the PrintJob row.
 */
async function enqueueUsbFile(file: FileDto) {
  if (!printerId.value || enqueuingUsbPath.value) return
  enqueuingUsbPath.value = file.path
  const tail = file.path.split('/').filter(Boolean).pop() || file.path
  try {
    await PrintQueueService.createJobFromUsbFile(printerId.value, {
      filePath: file.path,
      displayName: tail,
      fileSize: file.size ?? undefined,
    })
    snackbar.openInfoMessage({
      title: `Queued ${tail}`,
      subtitle: 'From printer USB',
    })
    await loadQueue()
    notifyPrintJobsChanged({ printerId: printerId.value, reason: 'usb:enqueue' })
  } catch (err: any) {
    console.error('Failed to enqueue USB file:', err)
    snackbar.openErrorMessage({
      title: 'Failed to enqueue',
      subtitle: err?.response?.data?.message || err?.response?.data?.error || err?.message || '',
    })
  } finally {
    enqueuingUsbPath.value = null
  }
}

watch(filesSource, async (source) => {
  if (source === 'storage' && printerId.value) {
    await loadStorage()
  }
})

/**
 * Auto-refresh the queue when this printer's state transitions in a way
 * that likely shifted the queue:
 *   - finished a print (printing → operational): queue head advanced
 *   - started/cancelled a print: position re-sync
 * We watch the boolean `isPrinting` for the current drawer printer so we
 * don't poll. This rides on the existing socket push pipeline.
 */
watch(isPrinting, async (next, prev) => {
  if (printerId.value && next !== prev) {
    await loadQueue()
  }
})

watch(printerId, async (newPrinterId, oldPrinterId) => {
  if (newPrinterId && newPrinterId !== oldPrinterId) {
    storageFolderPath.value = null
    storageSearch.value = ''
    const tasks: Promise<unknown>[] = [refreshFiles(), loadQueue()]
    if (filesSource.value === 'storage') tasks.push(loadStorage())
    await Promise.all(tasks)
  } else if (!newPrinterId) {
    fileList.value = undefined
    queueItems.value = []
    storageFolders.value = []
    storageFiles.value = []
    storageIncompatibleCount.value = 0
  }
})

// ─── Per-printer queue ─────────────────────────────────────────
async function loadQueue() {
  if (!printerId.value) return
  try {
    const response = await PrintQueueService.getPrinterQueue(printerId.value)
    queueItems.value = response.queue ?? []
  } catch (err) {
    console.warn('Failed to load printer queue:', err)
    queueItems.value = []
  }
}

async function removeFromQueue(job: QueuedJob) {
  if (!printerId.value) return
  try {
    const response = await PrintQueueService.removeFromQueue(printerId.value, job.id)
    queueItems.value = response.queue ?? []
    notifyPrintJobsChanged({ printerId: printerId.value, reason: 'queue:remove' })
  } catch (err) {
    console.error('Failed to remove queue item:', err)
  }
}

async function applyQueueReorder(reordered: QueuedJob[]) {
  if (!printerId.value || queueReordering.value) return

  const previous = queueItems.value
  queueItems.value = reordered // optimistic update for snappy feedback

  queueReordering.value = true
  try {
    const response = await PrintQueueService.reorderQueue(
      printerId.value,
      reordered.map(j => j.id)
    )
    queueItems.value = response.queue ?? reordered
    notifyPrintJobsChanged({ printerId: printerId.value, reason: 'queue:reorder' })
  } catch (err) {
    console.error('Failed to reorder queue:', err)
    queueItems.value = previous
    await loadQueue()
  } finally {
    queueReordering.value = false
  }
}

function onQueueDragStart(index: number, ev: DragEvent) {
  draggingIndex.value = index
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    // Required for Firefox to actually fire dragstart.
    ev.dataTransfer.setData('text/plain', String(index))
  }
}

function onQueueDragOver(index: number) {
  if (draggingIndex.value === null || draggingIndex.value === index) return
  dragOverIndex.value = index
}

function onQueueDragLeave(index: number) {
  if (dragOverIndex.value === index) dragOverIndex.value = null
}

function onQueueDragEnd() {
  draggingIndex.value = null
  dragOverIndex.value = null
}

function onQueueDrop(target: number) {
  const source = draggingIndex.value
  draggingIndex.value = null
  dragOverIndex.value = null
  if (source === null || source === target) return

  const reordered = [...queueItems.value]
  const [moved] = reordered.splice(source, 1)
  reordered.splice(target, 0, moved)
  applyQueueReorder(reordered)
}

async function processNextInQueue() {
  if (!printerId.value || queueProcessing.value) return
  queueProcessing.value = true
  try {
    await PrintQueueService.processQueue(printerId.value)
    await loadQueue()
    notifyPrintJobsChanged({ printerId: printerId.value, reason: 'queue:process' })
  } catch (err) {
    console.error('Failed to process queue:', err)
  } finally {
    queueProcessing.value = false
  }
}

async function clickClearQueue() {
  if (!printerId.value) return
  const count = queueItems.value.length
  const ok = await confirmDialog({
    title: `Clear ${count} job${count === 1 ? '' : 's'} from the queue?`,
    message:
      `All queued jobs on this printer will be removed. The currently running print, if any, won't be affected.`,
    confirmText: 'Clear queue',
    severity: 'warning',
    icon: 'delete_sweep',
  })
  if (!ok) return
  try {
    await PrintQueueService.clearQueue(printerId.value)
    queueItems.value = []
    notifyPrintJobsChanged({ printerId: printerId.value, reason: 'queue:clear' })
  } catch (err) {
    console.error('Failed to clear queue:', err)
  }
}

function queueStatusColor(status: string): string | undefined {
  const s = status?.toLowerCase()
  if (s === 'queued' || s === 'pending') return 'primary'
  if (s === 'submitted' || s === 'in_progress' || s === 'processing') return 'success'
  if (s === 'failed' || s === 'error') return 'error'
  if (s === 'cancelled' || s === 'skipped') return 'warning'
  return undefined
}

function formatHeroFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatFilamentGrams(value: number | number[] | null | undefined): string {
  if (value == null) return ''
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    const total = value.reduce((acc, v) => acc + (v ?? 0), 0)
    if (total <= 0) return ''
    return `${Math.round(total)}g`
  }
  if (value <= 0) return ''
  return `${Math.round(value)}g`
}

function formatFilamentType(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(' / ')
  if (typeof value === 'string') return value
  return ''
}

function formatQueueDuration(seconds: number): string {
  if (!seconds || seconds < 60) return `${Math.round(seconds || 0)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function truncateProgress(progress?: number) {
  if (!progress) return ''
  return progress?.toFixed(1)
}

function isFileBeingPrinted(file: FileDto) {
  if (!printerId.value) {
    return false
  }
  const jobFilePath =
    printerStateStore.printingFilePathsByPrinterId[printerId.value]
  return jobFilePath === file.path
}

function avatarInitials() {
  const viewedPrinter = storedSideNavPrinter.value
  if (viewedPrinter && drawerOpened.value) {
    return generateInitials(viewedPrinter.name)
  }
}

function openPrinterURL() {
  if (!storedSideNavPrinter.value) return
  PrintersService.openPrinterURL(storedSideNavPrinter.value.printerURL)
  closeDrawer()
}

async function togglePrinterConnection() {
  if (!printerId.value) return
  if (printerStateStore.isPrinterOperational(printerId.value)) {
    return await PrintersService.sendPrinterDisconnectCommand(printerId.value)
  }
  await PrintersService.sendPrinterConnectCommand(printerId.value)
}

async function toggleEnabled() {
  if (!printerId.value) {
    throw new Error('Printer ID not set, cant toggle enabled')
  }
  if (!storedSideNavPrinter.value) {
    throw new Error('Cant toggle enabled, sidenav printer unset')
  }
  const newSetting = !storedSideNavPrinter.value.enabled
  await PrintersService.toggleEnabled(printerId.value, newSetting)
}

async function toggleMaintenance() {
  if (!printerId.value) {
    throw new Error('Printer ID not set, cant toggle maintenance')
  }
  if (!storedSideNavPrinter.value) {
    throw new Error('Cant toggle enabled, sidenav printer unset')
  }
  if (isUnderMaintenance.value) {
    const activeLog = await PrinterMaintenanceLogService.getActiveByPrinterId(printerId.value)
    if (activeLog) {
      await PrinterMaintenanceLogService.complete(activeLog.id, {})
    }
    return
  }
  await useDialog(DialogName.PrinterMaintenanceDialog).openDialog({ printerId: printerId.value })

  closeDrawer()
}

async function refreshSocketState() {
  if (!printerId.value) return

  await PrintersService.refreshSocket(printerId.value)
}

async function clickStopPrint() {
  if (!printerId.value) return
  const ok = await confirmDialog({
    title: 'Cancel current print?',
    message: 'The print will stop immediately and progress will be lost.',
    hint: 'You can restart it from the printer\'s queue once it\'s back online.',
    confirmText: 'Cancel print',
    cancelText: 'Keep printing',
    severity: 'danger',
    icon: 'stop_circle',
  })
  if (!ok) return
  await PrintersService.stopPrintJob(printerId.value)
  notifyPrintJobsChanged({ printerId: printerId.value, reason: 'drawer:stop' })
}

async function clickPausePrint() {
  if (!printerId.value) return
  await PrintersService.pausePrintJob(printerId.value)
  notifyPrintJobsChanged({ printerId: printerId.value, reason: 'drawer:pause' })
}

async function clickResumePrint() {
  if (!printerId.value) return
  await PrintersService.resumePrintJob(printerId.value)
  notifyPrintJobsChanged({ printerId: printerId.value, reason: 'drawer:resume' })
}

function clickSettings() {
  if (!storedSideNavPrinter.value) return
  useDialog(DialogName.AddOrUpdatePrinterDialog).openDialog({ id: storedSideNavPrinter.value.id })
  closeDrawer()
}

function clickDownloadFile(path: string) {
  if (!printerId.value) return
  PrinterRemoteFileService.downloadFile(printerId.value, path)
}

function closeDrawer() {
  fileExplorer.closeFileExplorer()
}

function getStatusColor() {
  if (!isEnabled.value) return 'error'
  if (!isOnline.value) return 'warning'
  if (isPrinting.value) return 'success'
  if (isOperational.value) return 'primary'
  return 'medium-emphasis'
}

function getStatusIcon() {
  if (!isEnabled.value) return 'power_off'
  if (!isOnline.value) return 'wifi_off'
  if (isPrinting.value) return 'print'
  if (isOperational.value) return 'check_circle'
  return 'radio_button_unchecked'
}

function getStatusText() {
  if (!isEnabled.value) return 'Disabled'
  if (!isOnline.value) return 'Offline'
  if (isPrinting.value && isPaused.value) return 'Paused'
  if (isPrinting.value) return 'Printing'
  if (isOperational.value) return 'Ready'
  return 'Idle'
}

function getTreeIcon(item: TreeNode) {
  if (item.type === 'folder') {
    return 'folder'
  }
  if (item.file && isFileBeingPrinted(item.file)) {
    return 'play_circle'
  }
  return 'insert_drive_file'
}
</script>
<style scoped>
.printer-side-nav {
  background: rgb(var(--v-theme-surface));
}

.printer-side-nav :deep(.v-navigation-drawer__content) {
  /* Single scroll context: the whole drawer scrolls when content exceeds
     its visible height. Rely on Vuetify's layout-aware sizing — don't set
     an explicit height or the drawer extends past the viewport. */
  overflow-y: auto !important;
}

.min-width-0 {
  min-width: 0;
}

/* ── Sticky header ───────────────────────────────────────────── */
.ps-header {
  position: sticky;
  top: 0;
  z-index: 3;
  background: rgb(var(--v-theme-surface));
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.ps-header__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ps-header__avatar {
  flex-shrink: 0;
}

.ps-header__title {
  flex: 1 1 auto;
  min-width: 0;
}

.ps-header__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.ps-header__progress {
  margin-top: 10px;
}

/* ── Action toolbar ──────────────────────────────────────────── */
.ps-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* ── Alerts ──────────────────────────────────────────────────── */
.ps-alerts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 0;
}

/* Attention banner — pulse a subtle outline when severity is critical so
   it grabs the eye on first open. */
.ps-attention {
  border-left: 3px solid transparent;
}

.ps-attention--critical {
  border-left-color: rgb(var(--v-theme-error));
  animation: ps-attention-pulse 2.2s ease-in-out 2;
}

@keyframes ps-attention-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--v-theme-error), 0); }
  50% { box-shadow: 0 0 0 4px rgba(var(--v-theme-error), 0.18); }
}

@media (prefers-reduced-motion: reduce) {
  .ps-attention--critical { animation: none; }
}

/* ── Per-printer queue ──────────────────────────────────────── */
.ps-queue {
  padding: 8px 16px 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.ps-queue__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.ps-queue__empty {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  padding: 8px 4px;
}

/* ─── Hero card for the next-up queued job ─────────────────── */
.ps-queue__hero {
  display: block;
  padding: 10px 12px 12px;
  margin-bottom: 8px;
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
  border-left-width: 3px;
  border-radius: 10px;
  background: linear-gradient(
    180deg,
    rgba(var(--v-theme-primary), 0.07),
    rgba(var(--v-theme-primary), 0.02) 65%,
    transparent
  );
  cursor: grab;
  position: relative;
  transition: opacity 0.12s ease, transform 0.06s ease, border-color 0.12s ease;
}

.ps-queue__hero:active {
  cursor: grabbing;
}

.ps-queue__hero--dragging {
  opacity: 0.45;
}

.ps-queue__hero--drop-target {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.35) inset;
}

.ps-queue__hero-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 8px;
}

.ps-queue__hero-body {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

.ps-queue__hero-thumb {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  overflow: hidden;
}

.ps-queue__hero-thumb :deep(.thumbnail-container) {
  width: 72px;
  height: 72px;
  border-radius: 8px;
}

.ps-queue__hero-thumb-img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
}

.ps-queue__hero-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ps-queue__hero-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
  word-break: break-all;
  /* Wrap up to two lines; longer names get the title tooltip already. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ps-queue__hero-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 20px;
}

.ps-queue__hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.75);
  margin-top: 2px;
}

.ps-queue__hero-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.ps-queue__remove--hero {
  align-self: flex-start;
  width: 28px;
  height: 28px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.ps-queue__remove--hero:hover {
  background: rgba(var(--v-theme-error), 0.12);
  color: rgb(var(--v-theme-error));
}

.ps-queue__list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.ps-queue__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: grab;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: background-color 0.12s ease, opacity 0.12s ease;
  position: relative;
}

.ps-queue__item:first-child {
  border-top: none;
}

.ps-queue__item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.ps-queue__item:active {
  cursor: grabbing;
}

.ps-queue__item--dragging {
  opacity: 0.4;
}

.ps-queue__item--drop-above::before,
.ps-queue__item--drop-below::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  background: rgb(var(--v-theme-primary));
  border-radius: 1px;
  pointer-events: none;
}

.ps-queue__item--drop-above::before {
  top: -1px;
}

.ps-queue__item--drop-below::after {
  bottom: -1px;
}

.ps-queue__handle {
  flex-shrink: 0;
  color: rgba(var(--v-theme-on-surface), 0.35);
  cursor: grab;
}

.ps-queue__position {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
  font-size: 11px;
  font-weight: 700;
}

.ps-queue__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ps-queue__name {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
}

.ps-queue__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ps-queue__remove {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.55);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.ps-queue__remove:hover {
  background: rgba(var(--v-theme-error), 0.12);
  color: rgb(var(--v-theme-error));
}

/* ── Files section ───────────────────────────────────────────── */
.ps-files {
  padding: 12px 16px 16px;
}

.ps-files__source-tabs {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.ps-files__source-tabs :deep(.v-btn-toggle) {
  width: 100%;
}

.ps-files__source-tabs :deep(.v-btn-toggle .v-btn) {
  flex: 1 1 auto;
}

.ps-storage-thumb {
  width: 40px !important;
  height: 40px !important;
  flex-shrink: 0;
}

.ps-storage-thumb :deep(.thumbnail-container) {
  width: 40px;
  height: 40px;
  border-radius: 6px;
}

.ps-files__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  min-height: 32px;
}

.ps-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  gap: 2px;
}

.ps-breadcrumb::-webkit-scrollbar {
  height: 4px;
}

.ps-breadcrumb::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 2px;
}

.ps-breadcrumb::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 2px;
}

.ps-files__search {
  margin-bottom: 8px;
}

.ps-files__list {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.ps-files__items :deep(.v-list-item) {
  transition: background-color 0.15s ease;
  min-height: 44px;
}

.ps-files__items :deep(.v-list-item:hover) {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.ps-file-item--folder {
  cursor: pointer;
}

.ps-file-item__actions {
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.ps-file-item:hover .ps-file-item__actions,
.ps-file-item:focus-within .ps-file-item__actions {
  opacity: 1;
}
</style>
