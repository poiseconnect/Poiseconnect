import { createClient } from "@supabase/supabase-js";

// ---- ENV ----
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ---- FIX: STABLE LOCAL STORAGE FOR iOS ----
const customStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};

// ---- SUPABASE CLIENT ----
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customStorage,           // ← WICHTIG: iOS Fix
    storageKey: "poiseconnect-auth",  // eigener Storage Namespace
  },
});
