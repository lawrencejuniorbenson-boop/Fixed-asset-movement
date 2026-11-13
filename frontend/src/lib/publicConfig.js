/**
 * Public Supabase connection for this deployment.
 *
 * The anon key is designed to be public: it is shipped to every browser
 * anyway, and the database's Row Level Security rules decide what it can do.
 * NEVER put the service-role (secret) key here.
 *
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (or the NEXT_PUBLIC_* versions)
 * set in Vercel take priority over these values.
 */
export const DEFAULT_SUPABASE_URL = 'https://qtxkaizlfaaicgzcbkiv.supabase.co'
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0eGthaXpsZmFhaWNnemNia2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4ODIwMDcsImV4cCI6MjEwOTQ1ODAwN30.8vZO16l5gyNU7pEm5mVkM0SSqxGLYvftZvNzIbxbMbw'
