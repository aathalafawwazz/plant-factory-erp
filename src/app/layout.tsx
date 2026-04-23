import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agrosphere — SARC UGM",
  description: "Agrosphere ERP untuk Plant Factory — Smart Agriculture Research Center, Universitas Gadjah Mada",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${poppins.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LangProvider>
            {children}
            <Toaster position="top-center" richColors />
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
