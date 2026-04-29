import { supabase } from "./supabase.js";

export async function loadUserData(userId) {
  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", userId)
    .single();
  // PGRST116 = no rows found (new user) — not an error
  if (error && error.code !== "PGRST116") throw error;
  return data?.data ?? null;
}

export async function saveUserData(userId, store) {
  // Strip Strava tokens — these stay in localStorage only until Phase 3 moves them server-side
  const { strava: _omit, ...toSave } = store;
  const { error } = await supabase
    .from("user_data")
    .upsert({ user_id: userId, data: toSave, updated_at: new Date().toISOString() });
  if (error) throw error;
}
