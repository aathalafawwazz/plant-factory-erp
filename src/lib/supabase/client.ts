import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail loudly in the browser console — easier to spot than a vague
    // network error from a half-initialised client.
    // eslint-disable-next-line no-console
    console.error(
      "[supabase/client] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars. Set them in your deploy target and redeploy."
    );
    throw new Error("Supabase environment variables are missing.");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
