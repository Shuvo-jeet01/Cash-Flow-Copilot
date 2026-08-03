import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code)
    return NextResponse.redirect(
      new URL("/sign-in?message=Invalid%20confirmation%20link.", request.url),
    );
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(
      new URL(
        "/sign-in?message=Unable%20to%20confirm%20that%20account.",
        request.url,
      ),
    );
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const displayName = String(
      data.user.user_metadata.display_name ??
        data.user.email?.split("@")[0] ??
        "Member",
    ).slice(0, 100);
    await supabase.rpc("ensure_profile", { profile_display_name: displayName });
  }
  return NextResponse.redirect(new URL("/organizations", request.url));
}
