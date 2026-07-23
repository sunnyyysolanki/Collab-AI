// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   build: {
//     outDir: 'dist'
//   },
//   base: '/',
//   server: {
//     headers: {
//       "Cross-Origin-Embedder-Policy": "require-corp",
//       "Cross-Origin-Opener-Policy": "same-origin"
//     },

//     // proxy: {
//     //   '/cdn': {
//     //     target: 'http://localhost:3006',
//     //     changeOrigin: true,
//     //     secure: false
//     //   }
//     // }
//   }
// })


import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 500, // Still show warnings but optimize
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return id.split("node_modules/")[1].split("/")[0]; // Split dependencies
          }
        },
      },
    },
  },
});