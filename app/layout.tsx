import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "MONO Finance",
  description: "จัดการการเงินส่วนบุคคลของคุณในที่เดียว",
};

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
