import { Navbar } from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F7F4EF]">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
