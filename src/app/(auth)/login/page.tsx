"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sprout } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email atau kata sandi salah. Silakan coba lagi.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      {/* Subtle gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[oklch(0.65_0.18_260/0.08)] blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-[360px]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-[oklch(0.65_0.18_260)] items-center justify-center mb-4 shadow-lg shadow-[oklch(0.65_0.18_260/0.25)]">
            <Sprout className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Plant Factory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sistem Manajemen Plant Factory — SARC UGM
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@ugm.ac.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-[oklch(0.65_0.18_260)] focus-visible:border-[oklch(0.65_0.18_260/0.5)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] text-muted-foreground">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-[oklch(0.65_0.18_260)] focus-visible:border-[oklch(0.65_0.18_260/0.5)]"
              />
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white font-medium shadow-lg shadow-[oklch(0.65_0.18_260/0.2)] transition-all"
              disabled={loading}
            >
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
