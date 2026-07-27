import { useState } from "react";
import { motion } from "framer-motion";
import { useApp, useCurrentUser } from "@/lib/store";
import { Bell, Moon, Sun, Shield, Lock, Globe, Monitor, LogOut, ChevronRight, User, AtSign } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { theme, setTheme, logout } = useApp();
  const currentUser = useCurrentUser();

  const handleLogout = () => {
    logout();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[800px] mx-auto min-h-[100dvh] pb-24 md:pb-8 bg-background"
    >
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md p-4 border-b border-border">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="p-4 md:p-8 space-y-8">
        
        {/* Account */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 px-2">Account</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <AtSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Username</div>
                  <div className="text-sm text-muted-foreground">@{currentUser?.username || '—'}</div>
                </div>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Display Name</div>
                  <div className="text-sm text-muted-foreground">{currentUser?.name || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 px-2">Appearance</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-border hover:bg-accent/50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Theme</div>
                  <div className="text-sm text-muted-foreground">Select your interface preference</div>
                </div>
              </div>
              <div className="flex bg-muted p-1 rounded-lg">
                <button 
                  onClick={() => setTheme('light')}
                  className={`p-2 rounded-md transition-colors ${theme === 'light' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                  <Sun className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={`p-2 rounded-md transition-colors ${theme === 'dark' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                  <Moon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 px-2">Notifications</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {[
              { icon: Bell, title: "Push Notifications", desc: "Receive alerts on your device", color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
              { icon: Shield, title: "Security Alerts", desc: "Get notified of new logins", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" }
            ].map((item, i) => (
              <div key={i} className="p-4 flex items-center justify-between border-b border-border last:border-0 hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </section>

        {/* Account & Privacy */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 px-2">Account & Privacy</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {[
              { icon: Lock, title: "Privacy", desc: "Control who sees your content" },
              { icon: Globe, title: "Language", desc: "English (US)" }
            ].map((item, i) => (
              <div key={i} className="p-4 flex items-center justify-between border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            ))}
          </div>
        </section>

        <section className="pt-4">
          <Button 
            variant="destructive" 
            className="w-full h-14 rounded-2xl font-bold text-base shadow-lg shadow-destructive/20"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Log Out
          </Button>
        </section>

      </div>
    </motion.div>
  );
}
