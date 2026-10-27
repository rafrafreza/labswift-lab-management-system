import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, LogIn, Eye, EyeOff, Lock, Mail, ShieldCheck, Linkedin } from "lucide-react";
import { toast } from "sonner";

import { authLinkError, authLinkType, supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(authLinkError ?? "");
  const [isSettingPassword, setIsSettingPassword] = useState(authLinkType === "recovery" || authLinkType === "invite");
  const [newPassword, setNewPassword] = useState("");
  const [settingLoading, setSettingLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session && profile && !isSettingPassword) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, profile, authLoading, navigate, isSettingPassword]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "USER_UPDATED") {
        setIsSettingPassword(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSettingLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password set! You are now logged in.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setSettingLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) { setError("Enter your email address first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    if (error) { setError(error.message); return; }
    setError("");
    toast.success("Password reset link sent to your email");
  }

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f38 50%, #0a2240 100%)" }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-5"
            style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-5"
            style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)", transform: "translate(30%, 30%)" }} />
        </div>

        <div className="relative z-10 pt-4 pl-8">
          <div className="flex items-center gap-3 mb-16">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-xl shadow-emerald-900/50">
              <FlaskConical className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xl font-bold text-white tracking-tight">Labswift</div>
              <div className="text-[11px] text-emerald-400/70 tracking-widest uppercase font-medium">LIMS Platform</div>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight" style={{ letterSpacing: "-0.04em" }}>
              Modern Lab<br />Management,<br />
              <span className="text-emerald-400">Simplified.</span>
            </h1>
            <p className="text-slate-400 text-[15px] leading-relaxed max-w-sm">
              Streamline patient reports, test templates, and doctor incentives - all in one professional platform.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {[
              { icon: "🔬", text: "Smart report generation with abnormal value detection" },
              { icon: "👨‍⚕️", text: "Doctor referral & incentive tracking system" },
              { icon: "📄", text: "Professional PDF reports - print-ready" },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                <span className="text-slate-400 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="relative z-10 pl-8 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400/70" />
          <span className="text-xs text-slate-500">Encrypted & Secure</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] animate-scale-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Labswift</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 backdrop-blur-xl shadow-2xl">
            {isSettingPassword ? (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                    Set your password
                  </h2>
                  <p className="text-slate-400 text-sm mt-1.5">Create a secure password for your account</p>
                </div>

                {error && (
                  <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        required minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all pr-11"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={settingLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50">
                    {settingLoading
                      ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Setting password...</>
                      : <><LogIn className="h-4 w-4" /> Set Password & Sign In</>}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-7">
                  <h2 className="text-2xl font-bold text-white tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                    Welcome back
                  </h2>
                  <p className="text-slate-400 text-sm mt-1.5">Sign in to your Labswift workspace</p>
                </div>

                {error && (
                  <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="email" required autoComplete="email"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@lab.com"
                        className="w-full rounded-xl bg-white/10 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type={showPw ? "text" : "password"} required autoComplete="current-password"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        className="w-full rounded-xl bg-white/10 border border-white/10 pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 mt-2">
                    {loading
                      ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Signing in...</>
                      : <><LogIn className="h-4 w-4" /> Sign In</>}
                  </button>

                  <button type="button" onClick={handleForgotPassword}
                    className="w-full text-center text-xs text-slate-500 hover:text-emerald-400 transition-colors mt-1">
                    Forgot password?
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-[11px] text-slate-600 mt-6">
            © {new Date().getFullYear()} Labswift · All rights reserved
          </p>
          <div className="relative z-10 mt-3 flex justify-center">
            <a
              href="https://www.linkedin.com/in/rafrafreza"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-600 transition-colors hover:text-emerald-600"
            >
              <span>Developed by Rafraf Reza</span>
              <Linkedin className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
