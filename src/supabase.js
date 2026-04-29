import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

const configured =
  url && key &&
  !url.includes("your-project") &&
  key !== "your-anon-key-here";

export const supabase = configured ? createClient(url, key) : null;
export const supabaseConfigured = configured;
