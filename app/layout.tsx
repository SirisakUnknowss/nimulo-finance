import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { DemoStoreProvider } from "@/lib/demo/store";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
});

// Raw metadata URLs are not auto-prefixed with basePath on static export.
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "nimulo. — การเงินที่ทุกคนเข้าใจได้",
  description: "จัดการรายรับ รายจ่าย เงินออม หนี้สิน และการลงทุนของคุณในที่เดียว ผ่าน Dashboard ที่เรียบง่ายและเข้าใจได้",
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: [{ url: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${base}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "nimulo.", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#467A64" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${inter.variable} ${notoThai.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <DemoStoreProvider>{children}</DemoStoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
