import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useApp } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { signInWithUsername } from "@/lib/auth-utils";

export default function Login() {
  const { setIsAuthenticated } = useApp();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const username = usernameRef.current?.value?.trim() || "";
      const password = passRef.current?.value || "";

      if (!username) {
        setError("Username is required");
        setLoading(false);
        return;
      }

      const { error: authError } = await signInWithUsername(username, password);
      if (authError) throw new Error(authError);
      setIsAuthenticated(true);
      setLocation("/feed");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side - Visual */}
      <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-900" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        
        <div className="relative z-10 text-white p-12 max-w-xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-16 h-16 bg-white text-primary rounded-2xl flex items-center justify-center font-bold text-4xl mb-8 shadow-2xl">
              S
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-6">
              Connect with your people.
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              Experience the most premium, crafted social network. Fast, beautiful, and focused on meaningful connections.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <div className="w-full max-w-md mx-auto">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="mb-10 text-center lg:text-left"
          >
            <div className="lg:hidden w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center font-bold text-2xl mb-6 mx-auto">
              S
            </div>
            <h2 className="text-3xl font-bold mb-2 text-foreground">Welcome back</h2>
            <p className="text-muted-foreground">Please enter your details to sign in.</p>
          </motion.div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3">{error}</div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Username</label>
              <Input 
                ref={usernameRef}
                type="text" 
                placeholder="Enter your username" 
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect="off"
                className="h-12 rounded-xl bg-card border-border px-4"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input 
                ref={passRef}
                type="password" 
                placeholder="••••••••" 
                autoComplete="current-password"
                className="h-12 rounded-xl bg-card border-border px-4"
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-border text-primary focus:ring-primary w-4 h-4" defaultChecked />
                <span className="text-muted-foreground font-medium">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-primary font-semibold hover:underline">Recover account</Link>
            </div>

            <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 mt-2" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground font-medium">Or continue with</span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full h-12 rounded-xl text-base font-medium bg-card">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground font-medium">
            Don't have an account? <Link href="/register" className="text-primary font-bold hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
