import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName =
  process.env.GITHUB_REPOSITORY?.split("/").pop() ||
  "evd-file-management-web-app";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? `/${repoName}/` : "/",
  plugins: [react()],
});
