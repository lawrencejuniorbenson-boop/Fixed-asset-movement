import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // VITE_* is the normal prefix. NEXT_PUBLIC_* is also accepted because the
  // Vercel <-> Supabase integration creates NEXT_PUBLIC_SUPABASE_URL /
  // NEXT_PUBLIC_SUPABASE_ANON_KEY. Both prefixes are public by convention;
  // never give a secret (e.g. the service-role key) either prefix.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true
  }
})
