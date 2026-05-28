<template>
  <v-card>
    <v-card-text>
      <SettingSection
        title="Experimental Server Features"
        tooltip="PrusaLink is the only printer adapter wired into this build."
        :usecols="false"
      >
        <div class="d-flex align-center mb-2">
          <v-checkbox
            v-model="experimentalPrusaLinkSupport"
            :disabled="isPrusaLinkSupportLoading"
            @change="updatePrusaLinkSupport"
            hide-details
            label="Enable Experimental PrusaLink Support"
          />
          <v-progress-circular
            v-if="isPrusaLinkSupportLoading"
            indeterminate
            size="30"
            width="4"
            class="ml-2"
          />
          <v-icon v-if="showPrusaLinkSuccess" color="success" class="ml-2">
            check_circle
          </v-icon>
        </div>
      </SettingSection>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { SettingsService } from '@/backend'
import SettingSection from '@/components/Settings/Shared/SettingSection.vue'

const experimentalPrusaLinkSupport = ref(false)
const isPrusaLinkSupportLoading = ref(false)
const showPrusaLinkSuccess = ref(false)

async function loadSettings() {
  const settings = await SettingsService.getSettings()
  experimentalPrusaLinkSupport.value = settings.server.experimentalPrusaLinkSupport
}

onMounted(async () => {
  await loadSettings()
})

const updatePrusaLinkSupport = async () => {
  isPrusaLinkSupportLoading.value = true
  showPrusaLinkSuccess.value = false

  try {
    await SettingsService.updateExperimentalPrusaLinkSupport(experimentalPrusaLinkSupport.value)
    await loadSettings()
    setTimeout(() => {
      isPrusaLinkSupportLoading.value = false
      showPrusaLinkSuccess.value = true
    }, 250)

    setTimeout(() => {
      showPrusaLinkSuccess.value = false
    }, 3000)
  } catch (error) {
    console.error('Failed to update PrusaLink support:', error)
    experimentalPrusaLinkSupport.value = !experimentalPrusaLinkSupport.value
    isPrusaLinkSupportLoading.value = false
  }
}
</script>
