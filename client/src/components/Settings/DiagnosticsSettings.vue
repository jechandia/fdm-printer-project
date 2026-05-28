<template>
  <v-card>
    <v-card-text>
      <SettingSection
        :usecols="false"
        title="Download a .zip file containing all logs from the server"
      >
        <v-row>
          <v-col cols="3">
            <v-btn
              color="primary"
              @click="downloadLogDump()"
            >
              <v-icon>download</v-icon>
              Download Log Files (.zip)
            </v-btn>
          </v-col>
        </v-row>
      </SettingSection>

      <v-divider />

      <SettingSection title="Clear log files">
        <v-btn
          color="default"
          @click="clearOldLogFiles()"
        >
          <v-icon>download</v-icon>
          Clear log files older than a week
        </v-btn>
      </SettingSection>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { ServerPrivateService } from '@/backend/server-private.service'
import { useSnackbar } from '@/shared/snackbar.composable'
import SettingSection from '@/components/Settings/Shared/SettingSection.vue'

const snackBar = useSnackbar()

async function downloadLogDump() {
  await ServerPrivateService.downloadLogDump()
}

async function clearOldLogFiles() {
  await ServerPrivateService.clearLogFilesOlderThanWeek()
  snackBar.openInfoMessage({
    title: 'Action success',
    subtitle: 'Log files older than a week have been deleted'
  })
}
</script>
