<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    class="sparkline"
    preserveAspectRatio="none"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Fill under the line, optional. -->
    <path
      v-if="fill && pathFill"
      :d="pathFill"
      :fill="resolvedColor"
      opacity="0.15"
    />

    <!-- The line itself. -->
    <path
      v-if="pathLine"
      :d="pathLine"
      :stroke="resolvedColor"
      :stroke-width="strokeWidth"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Trailing dot at the latest data point. -->
    <circle
      v-if="lastPoint"
      :cx="lastPoint.x"
      :cy="lastPoint.y"
      :r="strokeWidth * 1.4"
      :fill="resolvedColor"
    />
  </svg>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

interface Props {
  values: number[]
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
  fill?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  width: 120,
  height: 28,
  color: 'currentColor',
  strokeWidth: 1.5,
  fill: true,
  ariaLabel: 'Sparkline',
})

const resolvedColor = computed(() => props.color)

const normalised = computed(() => {
  const vals = props.values?.length ? props.values : []
  if (vals.length < 2) return []

  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1

  const pad = props.strokeWidth + 1
  const innerW = props.width - pad * 2
  const innerH = props.height - pad * 2

  return vals.map((v, i) => ({
    x: pad + (vals.length === 1 ? innerW / 2 : (i / (vals.length - 1)) * innerW),
    y: pad + (1 - (v - min) / range) * innerH,
  }))
})

const pathLine = computed(() => {
  const pts = normalised.value
  if (pts.length < 2) return ''
  return pts
    .map((p, i) => (i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`))
    .join(' ')
})

const pathFill = computed(() => {
  const pts = normalised.value
  if (pts.length < 2) return ''
  const bottom = props.height - props.strokeWidth - 1
  return [
    `M${pts[0].x.toFixed(1)},${bottom.toFixed(1)}`,
    ...pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${pts[pts.length - 1].x.toFixed(1)},${bottom.toFixed(1)}`,
    'Z',
  ].join(' ')
})

const lastPoint = computed(() => {
  const pts = normalised.value
  return pts.length ? pts[pts.length - 1] : null
})
</script>

<style scoped>
.sparkline {
  display: block;
  overflow: visible;
}
</style>
