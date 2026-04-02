import { Sidebar } from "@/components/app/sidebar";
import { MobileSidebar } from "@/components/app/mobile-sidebar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <div className="flex items-center border-b p-3 md:hidden">
          <MobileSidebar />
          <span className="ml-3 font-semibold">Fractik</span>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
