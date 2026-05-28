<template>
  <div class="d-flex align-start" style="gap: 12px;">
    <v-icon color="info">help_outline</v-icon>
    <div>
      <div class="text-body-2 mb-3">{{ message }}</div>
      <div class="d-flex gap-2 flex-wrap">
        <GithubIssuesButton
          :size="buttonSize"
          :color="githubColor"
          :variant="githubVariant"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import GithubIssuesButton from '@/components/Generic/Actions/GithubIssuesButton.vue'

interface Props {
  message?: string
  buttonSize?: 'x-small' | 'small' | 'default' | 'large' | 'x-large'
  githubVariant?: 'elevated' | 'flat' | 'tonal' | 'outlined' | 'text' | 'plain'
  githubColor?: string
}

withDefaults(defineProps<Props>(), {
  message: 'Need help getting started?',
  buttonSize: 'small',
  githubVariant: 'outlined',
  githubColor: 'default'
})
</script>
