import { Navbar } from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-app-bg">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
