/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 * Note to self: src/styles/vuetify-variables.d.css contains a subset of CSS variables.
 */

import 'material-design-icons-iconfont/dist/material-design-icons.css'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { aliases, md } from 'vuetify/iconsets/md'
import { mdi } from "vuetify/iconsets/mdi";
import { createVuetify } from 'vuetify'
import { VStepperVertical, VStepperVerticalItem } from "vuetify/labs/components";

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export const vuetify = createVuetify({
  // Prusa brand palette. Primary is the same orange that runs through
  // the printer hardware, the cape in the logo, and the heatbed
  // highlight on every printer tile. Accent is the lighter orange used
  // for hover/sparkle accents in the brand sheet.
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          primary: '#E04E00',
          secondary: '#3A3A3A',
          accent: '#FF8A3D',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107'
        }
      },
      light: {
        dark: false,
        colors: {
          primary: '#E04E00',
          secondary: '#3A3A3A',
          accent: '#FF8A3D',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107'
        }
      }
    }
  },
  icons: {
    defaultSet: 'md',
    aliases: {
      ...aliases,
    },
    sets: {
      md,
      mdi,
      custom: {
        component: (props) => props.icon,
      },
    }
  },
  components: {
    VStepperVertical,
    VStepperVerticalItem
  }
})
