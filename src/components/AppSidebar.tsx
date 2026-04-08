import { BarChart3, Users, Shield, User, Gauge } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin, canViewIndividual } = useUserRole();

  const items = [
    { title: "Dashboard", url: "/", icon: BarChart3, show: true },
    { title: "Capacidade", url: "/capacity", icon: Gauge, show: canViewIndividual },
    { title: "Desempenho Individual", url: "/individual", icon: Users, show: canViewIndividual },
    { title: "Administração", url: "/admin", icon: Shield, show: isAdmin },
    { title: "Meu Perfil", url: "/profile", icon: User, show: true },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="bg-card">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((item) => item.show)
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-accent/50"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
