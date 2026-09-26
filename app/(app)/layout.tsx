import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { MobileNav } from "@/components/shell/mobile-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 pb-20 pt-4 lg:px-8 lg:pb-8 lg:pt-6">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
