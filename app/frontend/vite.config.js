import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the React app runs on :5173 and the Express API on :4000.
// The proxy forwards every /api request to the API, so the browser only ever
// talks to one address and no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
});
