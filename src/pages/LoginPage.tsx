import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Circle, Eye, EyeOff, FlaskConical, KeyRound, Linkedin, Lock, LogIn, Mail, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { authLinkError, supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  clearPasswordSetup,
  getPendingPasswordSetup,
  isPasswordSetupPending,
  markPasswordSetupPending,
} from "@/lib/passwordSetup";
import { isValidEmail, passwordChecks, validatePassword } from "@/lib/validation";

type Mode = "signin" | "forgot" | "setPassword";

const RESET_COOLDOWN_SECONDS = 60;
const LINK_PROBLEM =
  "This link has expired or has already been used. Ask your administrator to send a new invitation, or choose Forgot password on the sign-in page to get a new link.";

const INPUT =
  "w-full rounded-xl bg-white/10 border border-white/10 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";
const PRIMARY_BUTTON =
  "w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50";

function describeSignInError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "This account hasn't been activated yet. Use the link in your invitation email.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  return message;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, user, profile, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>(() => (getPendingPasswordSetup() ? "setPassword" : "signin"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(authLinkError ? LINK_PROBLEM : "");
  const [notice, setNotice] = useState("");

  // Forgot password
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Create password (invitation or reset link)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [settingLoading, setSettingLoading] = useState(false);
  const finishing = useRef(false); // set while we deliberately sign out after a successful password change

  // Decide where this visit belongs: create-password screen, the app, or the sign-in form
  useEffect(() => {
    if (authLoading || finishing.current) return;

    if (session && isPasswordSetupPending(user)) {
      setMode("setPassword");
      return;
    }
    if (mode === "setPassword") {
      // A link was opened but it produced no session: it has expired or was already used
      clearPasswordSetup();
      setMode("signin");
      setError(LINK_PROBLEM);
      return;
    }
    if (session && profile) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, user, profile, authLoading, mode, navigate]);

  // Password-reset links announce themselves with this event (the persistent marker covers reloads)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordSetupPending("recovery");
        setMode("setPassword");
        setError("");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function goTo(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setFieldErrors({});
    setShowPw(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(describeSignInError(err instanceof Error ? err.message : "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0 || sendingReset) return;
    const address = email.trim().toLowerCase();
    if (!isValidEmail(address)) {
      setError("Enter the email address of your account.");
      return;
    }
    setError("");
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setResetSent(true);
      setCooldown(RESET_COOLDOWN_SECONDS);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(/rate limit|too many|seconds/i.test(message) ? "Too many requests. Please wait a minute and try again." : message || "Could not send the reset link.");
    } finally {
      setSendingReset(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    const problems = validatePassword(newPassword, confirmPassword, user?.email);
    setFieldErrors(problems);
    if (problems.password || problems.confirm) return;

    setError("");
    setSettingLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword, data: { password_set: true } });
      if (error) throw error;

      // Deliberately do not stay signed in on the one-time link session: send them to sign in with the new password
      const accountEmail = user?.email ?? "";
      finishing.current = true;
      clearPasswordSetup();
      setNewPassword("");
      setConfirmPassword("");
      setEmail(accountEmail);
      setPassword("");
      setMode("signin");
      setNotice("Your password has been set. Please sign in with your new password.");
      await supabase.auth.signOut();
      toast.success("Password set. You can now sign in.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        /same as the old|different from the old/i.test(message)
          ? "Your new password must be different from your current one."
          : /weak|password should/i.test(message)
            ? message
            : message || "Could not set the password. Please try again.",
      );
    } finally {
      finishing.current = false;
      setSettingLoading(false);
    }
  }

  async function handleCancelSetup() {
    finishing.current = true;
    clearPasswordSetup();
    setNewPassword("");
    setConfirmPassword("");
    goTo("signin");
    await supabase.auth.signOut();
    finishing.current = false;
  }

  const setupKind = getPendingPasswordSetup();
  const checks = [
    ...passwordChecks(newPassword),
    { label: "Both passwords match", ok: confirmPassword.length > 0 && newPassword === confirmPassword },
  ];

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
            {mode === "setPassword" ? (
              <>
                <div className="mb-6">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15">
                    <KeyRound className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                    {setupKind === "recovery" ? "Create a new password" : "Create your password"}
                  </h2>
                  <p className="text-slate-400 text-sm mt-1.5">
                    {setupKind === "recovery"
                      ? "Choose a new password for your account."
                      : "Welcome to LabSwift. Choose a password to activate your account."}
                  </p>
                  {user?.email && <p className="mt-2 text-xs text-slate-500">Account: <span className="text-slate-300">{user.email}</span></p>}
                </div>

                {error && (
                  <div role="alert" className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSetPassword} className="space-y-4" noValidate>
                  {/* Lets password managers save the new password against the right account */}
                  <input type="email" name="username" autoComplete="username" value={user?.email ?? ""} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5" htmlFor="new-password">Create password</label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        autoFocus
                        maxLength={72}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setFieldErrors((c) => ({ ...c, password: undefined })); }}
                        placeholder="At least 8 characters"
                        aria-invalid={Boolean(fieldErrors.password)}
                        className={`${INPUT} px-4 pr-11 ${fieldErrors.password ? "border-red-500/60" : ""}`}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.password}</p>}
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5" htmlFor="confirm-password">Confirm password</label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        maxLength={72}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((c) => ({ ...c, confirm: undefined })); }}
                        placeholder="Re-enter your password"
                        aria-invalid={Boolean(fieldErrors.confirm)}
                        className={`${INPUT} px-4 pr-11 ${fieldErrors.confirm ? "border-red-500/60" : ""}`}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {fieldErrors.confirm && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.confirm}</p>}
                  </div>

                  <ul className="space-y-1.5 rounded-xl bg-white/[0.04] px-4 py-3" aria-label="Password requirements">
                    {checks.map((c) => (
                      <li key={c.label} className={`flex items-center gap-2 text-xs ${c.ok ? "text-emerald-400" : "text-slate-500"}`}>
                        {c.ok ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                        {c.label}
                      </li>
                    ))}
                  </ul>

                  <button type="submit" disabled={settingLoading} className={PRIMARY_BUTTON}>
                    {settingLoading
                      ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving password...</>
                      : <><KeyRound className="h-4 w-4" /> Set password</>}
                  </button>

                  <button type="button" onClick={() => void handleCancelSetup()}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-emerald-400 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                  </button>
                </form>
              </>
            ) : mode === "forgot" ? (
              <>
                <div className="mb-6">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15">
                    <Send className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                    Reset your password
                  </h2>
                  <p className="text-slate-400 text-sm mt-1.5">
                    Enter your account email and we'll send you a link to create a new password.
                  </p>
                </div>

                {error && (
                  <div role="alert" className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {resetSent && (
                  <div role="status" className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
                    If an account exists for <span className="font-semibold">{email.trim()}</span>, a reset link is on its way.
                    Check your inbox and your spam folder. The link works once and expires after a while.
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5" htmlFor="reset-email">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        id="reset-email" type="email" autoComplete="email" maxLength={254}
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@lab.com"
                        className={`${INPUT} pl-10 pr-4`}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={sendingReset || cooldown > 0} className={PRIMARY_BUTTON}>
                    {sendingReset
                      ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Sending...</>
                      : cooldown > 0
                        ? <>Send again in {cooldown}s</>
                        : <><Send className="h-4 w-4" /> {resetSent ? "Send the link again" : "Send reset link"}</>}
                  </button>

                  <button type="button" onClick={() => { setResetSent(false); goTo("signin"); }}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-emerald-400 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
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

                {notice && (
                  <div role="status" className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
                    {notice}
                  </div>
                )}
                {error && (
                  <div role="alert" className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
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
                        className={`${INPUT} pl-10 pr-4`}
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
                        autoFocus={Boolean(notice)}
                        placeholder="Your password"
                        className={`${INPUT} pl-10 pr-11`}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className={`${PRIMARY_BUTTON} mt-2`}>
                    {loading
                      ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Signing in...</>
                      : <><LogIn className="h-4 w-4" /> Sign In</>}
                  </button>

                  <button type="button" onClick={() => goTo("forgot")}
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
