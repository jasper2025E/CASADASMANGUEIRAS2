import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://hdojwkshpqumurnfuero.supabase.co";
const fallbackPublishableKey = "sb_publishable_E7N-GXI-CNrpHsCYkNZixQ_z6kOjkxR";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  fallbackPublishableKey;

export const supabaseConfigured = Boolean(url && key);
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
