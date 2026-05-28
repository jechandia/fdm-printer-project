<template>
  <v-card>
    <v-card-title>About PrusaHero</v-card-title>
    <v-card-text>
      <p>
        PrusaHero is an open-source PrusaLink farm management system.
      </p>
      <p class="mt-4">
        <strong>Server version:</strong> {{ serverVersion }}<br />
        <strong>Client version:</strong> {{ version }}
      </p>
      <v-btn
        class="mt-3"
        variant="outlined"
        to="/settings/software-upgrade"
      >
        <v-icon>mdi:mdi-upgrade</v-icon>
        Visit Upgrade Settings
      </v-btn>
    </v-card-text>

    <v-card-title>Support</v-card-title>
    <v-card-text>
      <GithubIssuesButton />
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { AppService } from '@/backend/app.service'
import { version as clientVersion } from '../../../package.json'
import GithubIssuesButton from '@/components/Generic/Actions/GithubIssuesButton.vue'

const serverVersion = ref('')
const version = ref(clientVersion)

onMounted(async () => {
  const versionSpec = await AppService.getVersion()
  serverVersion.value = versionSpec.version
})
</script>
