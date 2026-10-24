import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

import { getProfile } from "@/lib/services/profiles";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [session, setSession]   = useState<Session | null>(null);
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  const loading = !sessionReady || !profileReady;

  async function syncProfile(nextUser: User | null) {
    if (!nextUser) {
      setProfile(null);
      setProfileReady(true);
      return;
    }

    try {
      const nextProfile = await getProfile(nextUser.id);

      if (!nextProfile.isActive) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        toast.error("Your account is inactive. Contact an administrator.");
        setProfileReady(true);
        return;
      }

      setProfile(nextProfile);
    } catch (err) {
      console.error("Profile fetch failed:", err);
      setProfile(null);
    } finally {
      setProfileReady(true);
    }
  }

  // Main auth effect — session init + auth state listener
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setSessionReady(true);
      void syncProfile(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionReady(true);
      setProfileReady(false);
      void syncProfile(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ✅ FIX: Refresh token when user comes back to the tab
  // Prevents auto-logout after ~1 hour of inactivity in background tabs
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.refreshSession();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setUser(null);
    setSession(null);
    setProfile(null);
  }

  async function refreshProfile() {
    if (!user) { setProfile(null); return; }
    const nextProfile = await getProfile(user.id);
    setProfile(nextProfile);
  }

  const value = useMemo<AuthState>(
    () => ({ user, session, profile, loading, isAdmin: profile?.role === "ADMIN", signIn, signOut, refreshProfile }),
    [user, session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within AuthProvider.");
  return context;
}