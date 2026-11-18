import type { Metadata, Viewport } from "next";
import { DM_Mono, Urbanist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const urbanist = Urbanist({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-urbanist", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

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
