import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Provide default values if environment variables are not set
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('⚠️  Supabase credentials not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
  }
  
  return createBrowserClient(url, key, {
    auth: {
      persistSession: false, // Disable session persistence to avoid stale token issues
      autoRefreshToken: false, // Disable auto-refresh to prevent fetch errors
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
        return fetch(url, options).catch((error) => {
          // Silently suppress network errors to prevent console spam
          console.debug('Supabase network error (suppressed):', error.message)
          // Return a failed response instead of throwing
          return new Response(JSON.stringify({ error: 'Network error', message: error.message }), {
            status: 0,
            statusText: 'Network Error',
          })
        })
      },
    },
  })
}
