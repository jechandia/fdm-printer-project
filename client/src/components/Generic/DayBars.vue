<template>
  <div class="day-bars" :title="hoverTitle">
    <div
      v-for="(b, i) in buckets"
      :key="b.date"
      class="day-bars__col"
      :title="bucketTitle(b)"
      :style="{ height: `${height}px` }"
    >
      <div class="day-bars__stack">
        <div
          v-if="b.completed > 0"
          class="day-bars__seg day-bars__seg--ok"
          :style="{ height: barHeight(b.completed) + 'px' }"
        />
        <div
          v-if="b.failed > 0"
          class="day-bars__seg day-bars__seg--fail"
          :style="{ height: barHeight(b.failed) + 'px' }"
        />
      </div>
      <div
        v-if="showLabels && (i === 0 || i === buckets.length - 1)"
        class="day-bars__label"
      >
        {{ shortDay(b.date) }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { DayBucket } from '@/shared/dashboard-statistics'

interface Props {
  buckets: DayBucket[]
  height?: number
  showLabels?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 56,
  showLabels: true,
})

const maxValue = computed(() =>
  Math.max(1, ...props.buckets.map((b) => b.total))
)

function barHeight(v: number): number {
  // Reserve a few px for the label so bars never push it off the bottom.
  const usable = props.height - 14
  return Math.max(2, Math.round((v / maxValue.value) * usable))
}

function shortDay(iso: string): string {
  const d = new Date(iso + 'T00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function bucketTitle(b: DayBucket): string {
  const fail = b.failed > 0 ? ` · ${b.failed} failed` : ''
  return `${shortDay(b.date)}: ${b.completed} completed${fail}`
}

const hoverTitle = computed(() => `Prints per day (last ${props.buckets.length} days)`)
</script>

<style scoped>
.day-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 100%;
}

.day-bars__col {
  flex: 1 1 0;
  min-width: 4px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
  cursor: default;
}

.day-bars__stack {
  display: flex;
  flex-direction: column-reverse; /* completed at bottom, failed stacked above */
  width: 100%;
  border-radius: 2px;
  overflow: hidden;
}

.day-bars__seg {
  width: 100%;
}

.day-bars__seg--ok {
  background: rgb(var(--v-theme-success));
}

.day-bars__seg--fail {
  background: rgb(var(--v-theme-error));
}

.day-bars__label {
  font-size: 9px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-top: 2px;
  line-height: 1;
}
</style>
