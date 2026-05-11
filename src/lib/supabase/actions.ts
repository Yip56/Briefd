"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import type { UserPreferences } from "@/lib/types";

// Service-role client bypasses RLS — for server-only operations
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function createUserProfile(
  userId: string,
  email: string
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("profiles")
    .insert({ id: userId, email })
    .single();

  // 23505 = unique_violation — profile already exists, that's fine
  if (error && error.code !== "23505") {
    return { error: error.message };
  }
  return { error: null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUserProfile(userId: string): Promise<UserPreferences | null> {
  const supabase = await createClient();

  const [profileResult, topicsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("user_topics").select("*").eq("user_id", userId).order("created_at"),
  ]);

  if (profileResult.error || !profileResult.data) return null;

  return {
    profile: profileResult.data,
    topics: topicsResult.data ?? [],
  };
}
