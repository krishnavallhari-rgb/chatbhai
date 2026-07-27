import { Link, useLocation } from "wouter";
import { 
  Home, 
  Search, 
  Compass, 
  MessageCircle, 
  Bell, 
  User, 
  Settings, 
  LogOut,
  PlusSquare,
  Menu
} from "lucide-react";
import { useApp, useCurrentUser } from "@/lib/store";
import { useUnreadCount } from "@/hooks/use-messages";
import { useNotifications } from "@/hooks/use-notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const [location] = useLocation();
  const { logout } = useApp();
  const currentUser = useCurrentUser();
  const unreadCount = useUnreadCount();
  const { unreadCount: notifCount } = useNotifications();

  const navItems = [
    { icon: Home, label: "Home", href: "/feed" },
    { icon: Search, label: "Search", href: "/search" },
    { icon: Compass, label: "Explore", href: "/explore" },
    { icon: MessageCircle, label: "Messages", href: "/messages", badge: unreadCount },
    { icon: Bell, label: "Notifications", href: "/notifications", badge: notifCount },
    { icon: PlusSquare, label: "Create", href: "/create" },
    { icon: User, label: "Profile", href: `/profile/${currentUser?.username || ''}` },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <aside className="hidden md:flex flex-col w-20 lg:w-64 h-[100dvh] border-r border-border bg-card sticky top-0 px-3 py-6 z-40 transition-all duration-300">
      <div className="flex items-center mb-10 px-3 lg:px-4">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-xl leading-none tracking-tight">S</span>
        </div>
        <span className="ml-3 font-semibold text-xl tracking-tight hidden lg:block text-foreground">Sphere</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-none">
        {navItems.map((item) => {
          const isActive = location === item.href || (location === "/" && item.href === "/feed");
          return (
            <Link key={item.label} href={item.href} className="block">
              <div
                className={`flex items-center gap-4 px-3 lg:px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-200 group relative
                ${isActive ? 'font-semibold text-foreground bg-accent' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`}
              >
                <item.icon className={`w-6 h-6 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110 text-primary' : 'group-hover:scale-110'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="hidden lg:block text-[15px]">{item.label}</span>
                {item.badge ? (
                  <span className="absolute right-3 lg:static lg:ml-auto bg-destructive text-destructive-foreground text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {item.badge}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 px-3 lg:px-4">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-4 rounded-xl h-12"
          onClick={() => logout()}
        >
          <LogOut className="w-5 h-5 mr-0 lg:mr-4" />
          <span className="hidden lg:block">Log out</span>
        </Button>
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const [location] = useLocation();
  const currentUser = useCurrentUser();
  const unreadCount = useUnreadCount();

  const navItems = [
    { icon: Home, href: "/feed" },
    { icon: Search, href: "/search" },
    { icon: PlusSquare, href: "/create" },
    { icon: MessageCircle, href: "/messages", badge: unreadCount },
    { icon: User, href: `/profile/${currentUser?.username || ''}` },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-card/90 backdrop-blur-md z-50 flex items-center justify-around px-2">
      {navItems.map((item) => {
        const isActive = location === item.href || (location === "/" && item.href === "/feed");
        return (
          <Link key={item.href} href={item.href} className="p-3 relative">
            <item.icon 
              className={`w-6 h-6 transition-transform ${isActive ? 'text-primary scale-110' : 'text-muted-foreground'}`} 
              strokeWidth={isActive ? 2.5 : 2}
            />
            {item.badge ? (
              <span className="absolute top-2 right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-card">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
