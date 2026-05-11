import { defineConfig, minimalPreset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimalPreset,
    maskable: {
      sizes: [512],
      padding: 0.1,
      resizeOptions: { background: '#1e3a8a' },
    },
    apple: {
      sizes: [180],
      padding: 0.1,
      resizeOptions: { background: '#1e3a8a' },
    },
  },
  images: ['public/icon.svg'],
})
