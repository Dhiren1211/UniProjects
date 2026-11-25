import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

// Fonts are self-hosted (src/app/fonts, latin subset) so builds never depend on
// fetching from Google Fonts - next/font/google breaks on Google's newer font URLs.
const urbanist = localFont({
  src: [
    { path: "./fonts/urbanist-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/urbanist-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/urbanist-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/urbanist-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-urbanist",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});
const dmMono = localFont({
  src: [
    { path: "./fonts/dm-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-dm-mono",
  display: "swap",
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: "UniProjects: capstone projects from Kyungsung University students",
  description:
    "Browse verified capstone design projects built by student teams across every Kyungsung University department, each reviewed by a supervising professor.",
  keywords: ["university projects", "student showcase", "capstone", "Kyungsung University", "UniProjects"],
  icons: { icon: "/ks-logo.svg" },
  openGraph: {
    type: "website",
    title: "UniProjects: capstone projects from Kyungsung University students",
    description: "Verified capstone design projects from every Kyungsung University department.",
    images: ["/hero/campus.jpg"],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${urbanist.variable} ${dmMono.variable}`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
