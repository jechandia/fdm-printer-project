<template>
  <v-card>
    <v-card-text>
      <SettingSection title="Current versions in use" :usecols="false">
        <div>Your server's version is: {{ serverVersion }}</div>
        <div>Your client's version is: {{ version }}</div>
      </SettingSection>

      <v-divider />

      <SettingSection
        title="Upgrade"
        :usecols="false"
      >
        <div class="mb-2">
          This build is a self-hosted monorepo — upgrades happen at the source.
        </div>
        <div class="mb-1">
          <code>cd &lt;repo&gt; &amp;&amp; git pull &amp;&amp; yarn install &amp;&amp; yarn build</code>
        </div>
        <div>
          Then restart the server (e.g. <code>systemctl restart prusahero</code>).
        </div>
      </SettingSection>
    </v-card-text>
  </v-card>
</template>
<script lang="ts" setup>
import { AppService } from '@/backend/app.service'
import { onMounted, ref } from 'vue'
import { version as packageJsonVersion } from '../../../package.json'
import SettingSection from '@/components/Settings/Shared/SettingSection.vue'

const serverVersion = ref('')
const version = ref(packageJsonVersion)

onMounted(async () => {
  const versionSpec = await AppService.getVersion()
  serverVersion.value = versionSpec.version
})
</script>
