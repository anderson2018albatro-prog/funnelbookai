import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export function DashboardShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SidebarTrigger />
              {title && <h1 className="truncate font-display text-base font-semibold sm:text-lg">{title}</h1>}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="shrink-0">
              <LogOut className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
