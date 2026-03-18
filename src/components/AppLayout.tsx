import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="fixed top-3 left-3 z-50">
            <SidebarTrigger className="bg-card border border-border rounded-md p-2 hover:bg-accent" />
          </div>
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
