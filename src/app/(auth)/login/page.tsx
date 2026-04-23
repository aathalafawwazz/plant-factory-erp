"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye, EyeOff, Globe, FileText, BookOpen, MessageCircle,
  Mail, Check, ChevronDown, Leaf, Droplets, Sprout,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { lang, setLang } = useLang();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  const t = translations[lang];

  // Tampilkan error dari /auth/callback (mis. Google access_denied, exchange error)
  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) setError(urlError);
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(t.errorWrong);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleGoogle() {
    setSocialLoading("google");
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Arahkan ke server route callback yang akan menukar code → session cookie,
        // lalu redirect ke `next` (dashboard / halaman yang diminta).
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
    if (error) {
      setSocialLoading(null);
      setError(`Google login gagal: ${error.message}`);
    }
    // onSuccess akan redirect keluar halaman ini, tidak perlu reset loading
  }

  async function handleMagicLink() {
    if (!email) {
      setError(t.errorEmailRequired);
      return;
    }
    setSocialLoading("magic");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
    setSocialLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success(t.magicSent);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-background relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-0 -left-20 h-[400px] w-[400px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 -right-20 h-[400px] w-[400px] rounded-full bg-emerald-400/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-[1040px] rounded-[24px] overflow-hidden border border-border/60 bg-card shadow-2xl shadow-primary/10">
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[640px]">
          {/* ============ LEFT: Branded illustration panel ============ */}
          <div
            className="relative overflow-hidden hidden md:flex flex-col justify-between p-10 text-white"
            style={{
              background:
                "linear-gradient(135deg, #0AD1C8 0%, #14B8A6 45%, #0F766E 100%)",
            }}
          >
            {/* Decorative blobs */}
            <div className="absolute -top-32 -right-24 h-[360px] w-[360px] rounded-full bg-white/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-24 h-[320px] w-[320px] rounded-full bg-emerald-200/25 blur-3xl pointer-events-none" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-cyan-100/10 blur-3xl pointer-events-none" />

            {/* Top: headline + feature chips (logo dipindah ke panel kanan) */}
            <div className="relative space-y-8 pt-6">
              <div className="space-y-3 max-w-[340px]">
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-semibold text-white/70">
                  <span className="h-1 w-8 bg-white/40 rounded-full" />
                  SmartAgri UGM
                </p>
                <h2 className="text-3xl font-bold leading-tight">
                  {t.heroTitle}
                </h2>
                <p className="text-[13px] text-white/80 leading-relaxed">
                  {t.heroSubtitle}
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                <FeaturePill icon={<Leaf className="h-3 w-3" />} label={t.featPlant} />
                <FeaturePill icon={<Droplets className="h-3 w-3" />} label={t.featHydro} />
                <FeaturePill icon={<Sprout className="h-3 w-3" />} label={t.featSmart} />
              </div>
            </div>

            {/* Bottom: language + links */}
            <div className="relative flex items-center justify-between gap-3 flex-wrap text-[12px] text-white/80">
              {/* Language selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLangOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setLangOpen(false), 150)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span className="font-medium">{lang === "id" ? "Indonesia" : "English"}</span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform", langOpen && "rotate-180")} />
                </button>
                {langOpen && (
                  <div className="absolute bottom-full left-0 mb-1 min-w-[140px] rounded-md bg-white text-foreground shadow-xl border border-border/40 py-1 z-10">
                    <LangOption active={lang === "id"} label="Indonesia" onClick={() => { setLang("id"); setLangOpen(false); }} />
                    <LangOption active={lang === "en"} label="English" onClick={() => { setLang("en"); setLangOpen(false); }} />
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="flex items-center gap-4">
                <FooterLink icon={<FileText className="h-3.5 w-3.5" />} label={t.terms} href="#" />
                <FooterLink icon={<BookOpen className="h-3.5 w-3.5" />} label={t.guide} href="#" />
                <FooterLink icon={<MessageCircle className="h-3.5 w-3.5" />} label={t.contact} href="#" />
              </div>
            </div>
          </div>

          {/* ============ RIGHT: Form panel ============ */}
          <div className="relative flex flex-col justify-center p-8 md:p-10">
            {/* Brand lockup (mobile + desktop) — di panel gelap kontrasnya jelas */}
            <div className="mb-6 flex items-center gap-2.5">
              <Image src="/agrosphere-logo.svg" alt="Agrosphere" width={40} height={40} className="h-10 w-10 shrink-0" priority />
              <div className="leading-tight">
                <h1
                  className="text-[18px] font-semibold"
                  style={{ background: "linear-gradient(90deg, #45DFB1 0%, #0AD1C8 100%)", WebkitBackgroundClip: "text", color: "transparent" }}
                >
                  Agrosphere
                </h1>
                <p className="text-[11px] text-muted-foreground">SmartAgri UGM</p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-5">
              <h2 className="text-2xl md:text-[28px] font-bold text-foreground">{t.signInTitle}</h2>
              <p className="text-[13px] text-muted-foreground mt-1.5">{t.signInSubtitle}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] text-foreground font-medium">{t.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@ugm.ac.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 bg-secondary border-border/50"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[13px] text-foreground font-medium">{t.password}</Label>
                  <button type="button" className="text-[11px] text-primary hover:text-primary/80 transition-colors">
                    {t.forgot}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 pr-10 bg-secondary border-border/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label={showPassword ? t.hidePw : t.showPw}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember + terms */}
              <label className="inline-flex items-start gap-2 cursor-pointer pt-1 select-none">
                <span className="relative inline-flex items-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only peer"
                  />
                  <span className={cn(
                    "h-4 w-4 rounded border transition-colors flex items-center justify-center",
                    remember ? "bg-primary border-primary" : "bg-secondary border-border/50"
                  )}>
                    {remember && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                </span>
                <span className="text-[12px] text-muted-foreground leading-snug">
                  {t.remember}
                </span>
              </label>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-[12px] text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/20 mt-1"
                disabled={loading}
              >
                {loading ? t.submitting : t.signIn}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-[11px] text-muted-foreground">{t.orWith}</span>
              </div>
            </div>

            {/* Social logins */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 border-border/50 hover:bg-secondary hover:border-border"
                onClick={handleGoogle}
                disabled={socialLoading !== null}
              >
                {socialLoading === "google" ? (
                  <span className="text-[12px] text-muted-foreground">...</span>
                ) : (
                  <>
                    <GoogleIcon className="h-4 w-4 mr-2" />
                    <span className="text-[13px]">Google</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 border-border/50 hover:bg-secondary hover:border-border"
                onClick={handleMagicLink}
                disabled={socialLoading !== null || !email}
                title={!email ? t.magicHint : t.magicTooltip}
              >
                {socialLoading === "magic" ? (
                  <span className="text-[12px] text-muted-foreground">...</span>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2 text-primary" />
                    <span className="text-[13px]">Magic Link</span>
                  </>
                )}
              </Button>
            </div>

            {/* Footer */}
            <p className="text-[12px] text-muted-foreground text-center mt-6">
              {t.noAccount}{" "}
              <span className="text-primary font-medium">{t.contactAdmin}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helper components
// ============================================================
function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-medium backdrop-blur-sm">
      {icon}
      {label}
    </span>
  );
}

function FooterLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 hover:text-white transition-colors">
      {icon}
      <span>{label}</span>
    </a>
  );
}

function LangOption({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-1.5 text-[13px] flex items-center justify-between hover:bg-secondary transition-colors",
        active ? "text-primary font-medium" : "text-foreground"
      )}
    >
      <span>{label}</span>
      {active && <Check className="h-3.5 w-3.5 text-primary" />}
    </button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.61z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

// ============================================================
// i18n dict
// ============================================================
const translations = {
  id: {
    heroTitle: "Cepat, Efisien, dan Terpadu",
    heroSubtitle:
      "Kelola rak, tanam, panen, riset, dan kunjungan plant factory UGM dari satu dashboard cerdas.",
    featPlant: "Plant Factory",
    featHydro: "Hidroponik",
    featSmart: "Smart Farming",
    terms: "Ketentuan",
    guide: "Panduan",
    contact: "Kontak",
    signInTitle: "Masuk",
    signInSubtitle: "Lanjutkan untuk mengelola Agrosphere.",
    email: "Email",
    password: "Kata Sandi",
    passwordPlaceholder: "Masukkan kata sandi",
    forgot: "Lupa kata sandi?",
    remember: "Ingat saya di perangkat ini",
    showPw: "Tampilkan kata sandi",
    hidePw: "Sembunyikan kata sandi",
    submitting: "Memproses...",
    signIn: "Masuk",
    orWith: "atau lanjut dengan",
    noAccount: "Belum punya akun?",
    contactAdmin: "Hubungi admin",
    errorWrong: "Email atau kata sandi salah. Silakan coba lagi.",
    errorEmailRequired: "Isi email dulu untuk menerima magic link.",
    magicTooltip: "Kirim link login ke email (tanpa kata sandi)",
    magicHint: "Isi email dulu untuk menggunakan magic link",
    magicSent: "Link login telah dikirim ke email Anda.",
  },
  en: {
    heroTitle: "Fast, Efficient, and Integrated",
    heroSubtitle:
      "Manage racks, plantings, harvests, research, and visits across your plant factory from one smart dashboard.",
    featPlant: "Plant Factory",
    featHydro: "Hydroponic",
    featSmart: "Smart Farming",
    terms: "Terms",
    guide: "Guide",
    contact: "Contact",
    signInTitle: "Sign in",
    signInSubtitle: "Continue to manage your Agrosphere.",
    email: "Email",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    forgot: "Forgot password?",
    remember: "Remember me on this device",
    showPw: "Show password",
    hidePw: "Hide password",
    submitting: "Signing in...",
    signIn: "Sign in",
    orWith: "or continue with",
    noAccount: "Don’t have an account?",
    contactAdmin: "Contact admin",
    errorWrong: "Email or password is incorrect. Please try again.",
    errorEmailRequired: "Enter your email first to receive a magic link.",
    magicTooltip: "Send a passwordless login link to your email",
    magicHint: "Enter your email first to use magic link",
    magicSent: "Login link has been sent to your email.",
  },
} as const;
