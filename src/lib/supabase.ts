// ==============================================================================
// AniDub India — Supabase Client Configuration
// ==============================================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')) 
  ? process.env.NEXT_PUBLIC_SUPABASE_URL 
  : 'https://bcdrgviqhdkwnbeubjph.supabase.co';

const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 10)
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
  : 'sb_publishable_uNOsqxjGmsl-HqjPnGI_iA_pTtlkO0Z';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export default supabase;
