import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalRes, servedRes] = await Promise.all([
    supabase
      .from("article_queue")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("article_queue")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("served", true),
  ]);

  const totalQueued  = totalRes.count  ?? 0;
  const totalServed  = servedRes.count ?? 0;
  const totalRemaining = totalQueued - totalServed;

  return NextResponse.json({
    totalQueued,
    totalServed,
    totalRemaining,
    nextRefreshAvailable: totalRemaining > 15,
  });
}
