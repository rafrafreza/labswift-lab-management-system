import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  // Id of the user whose profile is loaded (or loading). Auth events for the same user
  // (token refresh, tab refocus, INITIAL_SESSION) must not reset the app to the loading screen.
  const activeUserIdRef = useRef<string | null>(null);

  const loading = !sessionReady || !profileReady;

  async function syncProfile(nextUser: User | null) {
    activeUserIdRef.current = nextUser?.id ?? null;
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
        activeUserIdRef.current = null;
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
      // The listener below may already have started loading this user's profile
      if (activeUserIdRef.current === (data.session?.user?.id ?? null) && activeUserIdRef.current !== null) return;
      void syncProfile(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      const nextUser = nextSession?.user ?? null;

      // Same user (token refresh, tab refocus, duplicate INITIAL_SESSION): keep the session
      // fresh but leave the profile and the current screen alone.
      if (nextUser && nextUser.id === activeUserIdRef.current) {
        setSession(nextSession);
        return;
      }

      setSession(nextSession);
      setUser(nextUser);
      setSessionReady(true);
      setProfileReady(false);
      void syncProfile(nextUser);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Refresh the token when the user returns to a tab that has been in the background,
  // but only if it is close to expiring (avoids a network call on every tab switch).
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.auth.getSession();
      const expiresAt = data.session?.expires_at;
      if (data.session && expiresAt && expiresAt * 1000 - Date.now() < 5 * 60 * 1000) {
        await supabase.auth.refreshSession();
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
    activeUserIdRef.current = null;
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