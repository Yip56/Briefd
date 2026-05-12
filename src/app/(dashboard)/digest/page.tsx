import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/onboarding/ProfileForm";
import { DigestFeed } from "@/components/digest/DigestFeed";

export default async function DigestPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Onboarding: profile missing or occupation never set
  if (!profile || !profile.occupation) {
    return (
      <div className="py-4 max-w-2xl">
        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "32px",
              color: "#1D5C3A",
            }}
          >
            Welcome to Briefd
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: "var(--font-source-serif), Georgia, serif",
              fontSize: "15px",
              color: "#5C5750",
            }}
          >
            Let&apos;s personalise your daily digest in 3 quick steps.
          </p>
        </div>
        <ProfileForm />
      </div>
    );
  }

  return <DigestFeed />;
}
