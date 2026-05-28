<template>
  <div class="settings-view">
    <aside class="settings-nav">
      <div class="settings-nav__title">Settings</div>
      <nav>
        <template v-for="(group, gi) in visibleGroups" :key="gi">
          <div v-if="group.length" class="settings-nav__group">
            <ul class="settings-nav__list">
              <li v-for="item in group" :key="item.path">
                <router-link
                  :to="item.path"
                  class="settings-nav__item"
                  active-class="settings-nav__item--active"
                >
                  <v-icon size="18" class="settings-nav__icon">
                    {{ item.icon }}
                  </v-icon>
                  <span class="settings-nav__label">{{ item.title }}</span>
                </router-link>
              </li>
            </ul>
            <v-divider v-if="gi < visibleGroups.length - 1" class="my-1" />
          </div>
        </template>
      </nav>
    </aside>

    <main class="settings-content">
      <router-view />
    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue'
import { settingPage, settingsPage } from '@/router/setting.constants'
import { useProfileStore } from '@/store/profile.store'

const profileStore = useProfileStore()

onMounted(async () => {
  if (!profileStore.userId) {
    try {
      await profileStore.getProfile()
    } catch (error) {
      console.error('Failed to load profile for settings nav:', error)
    }
  }
})

const ADMIN_ONLY = new Set<string>([settingPage.apiKeys])

const visibleItems = computed(() => {
  if (profileStore.isAdmin) return settingsPage
  const filtered: Record<string, (typeof settingsPage)[keyof typeof settingsPage]> = {}
  for (const [key, value] of Object.entries(settingsPage)) {
    if (!ADMIN_ONLY.has(key)) filtered[key] = value
  }
  return filtered as typeof settingsPage
})

/**
 * Split the flat settings list into visual groups using the existing
 * `divider: true` flag as the section boundary, so the navigation reads
 * as semantic sections instead of one long scroll.
 */
const visibleGroups = computed(() => {
  const items = Object.values(visibleItems.value)
  const groups: typeof items[] = []
  let current: typeof items = []
  for (const item of items) {
    current.push(item)
    if (item.divider) {
      groups.push(current)
      current = []
    }
  }
  if (current.length) groups.push(current)
  return groups
})
</script>

<style scoped>
.settings-view {
  display: flex;
  align-items: flex-start;
  min-height: calc(100vh - var(--v-layout-top, 64px));
}

.settings-nav {
  position: sticky;
  top: 0;
  width: 240px;
  flex-shrink: 0;
  padding: 16px 12px;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  align-self: stretch;
  max-height: calc(100vh - var(--v-layout-top, 64px));
  overflow-y: auto;
}

.settings-nav__title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.55);
  padding: 4px 12px 12px;
}

.settings-nav__group + .settings-nav__group {
  margin-top: 4px;
}

.settings-nav__list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.settings-nav__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  margin-bottom: 2px;
  border-radius: 6px;
  text-decoration: none;
  color: rgba(var(--v-theme-on-surface), 0.78);
  font-size: 13.5px;
  position: relative;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.settings-nav__item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgb(var(--v-theme-on-surface));
}

.settings-nav__icon {
  flex-shrink: 0;
  opacity: 0.75;
}

.settings-nav__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-nav__item--active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.settings-nav__item--active .settings-nav__icon {
  opacity: 1;
  color: rgb(var(--v-theme-primary));
}

.settings-nav__item--active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: rgb(var(--v-theme-primary));
}

.settings-content {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
}
</style>
