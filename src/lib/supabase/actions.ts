"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserPreferences } from "@/lib/types";

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
