import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // hoặc '/' tùy deploy
  build: {
    outDir: 'dist'
  }
})
