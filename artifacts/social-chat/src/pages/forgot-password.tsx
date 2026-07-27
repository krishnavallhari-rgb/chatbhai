import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import { recoverAccountByUsername } from "@/lib/auth-utils";

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const usernameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const username = usernameRef.current?.value?.trim() || "";
      if (!username) {
        setError("Username is required");
        setLoading(false);
        return;
      }

      const { error: recoveryError } = await recoverAccountByUsername(username);
      if (recoveryError) throw new Error(recoveryError);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to send recovery email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border p-8 rounded-3xl shadow-xl"
        >
          <Button variant="ghost" size="icon" className="mb-6 -ml-2 rounded-full" onClick={() => setLocation('/login')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {!submitted ? (
            <>
              <h2 className="text-2xl font-bold mb-2 text-foreground">Recover Account</h2>
              <p className="text-muted-foreground mb-8">
                Enter your username and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Username</label>
                  <Input 
                    ref={usernameRef}
                    type="text" 
                    placeholder="Enter your username" 
                    autoCapitalize="none"
                    autoComplete="username"
                    autoCorrect="off"
                    className="h-12 rounded-xl bg-background border-border px-4"
                    required
                  />
                </div>

                <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold shadow-md mt-4" disabled={loading}>
                  {loading ? "Sending..." : "Send Recovery Link"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-foreground">Check your email</h2>
              <p className="text-muted-foreground mb-8">
                If an account exists for that username, we've sent a password reset link.
              </p>
              <Button onClick={() => setLocation('/login')} className="w-full h-12 rounded-xl font-semibold">
                Return to Login
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
