import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "analyst";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase auth pattern)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer DB read to avoid deadlock in callback
        setTimeout(() => {
          supabase.from("user_roles").select("role").eq("user_id", sess.user.id).then(({ data }) => {
            setRoles((data ?? []).map((r) => r.role as AppRole));
          });
        }, 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        supabase.from("user_roles").select("role").eq("user_id", s.user.id).then(({ data }) => {
          setRoles((data ?? []).map((r) => r.role as AppRole));
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    session, user, roles, loading,
    isAdmin: roles.includes("admin"),
    isAnalyst: roles.includes("analyst") || roles.includes("admin"),
    signOut: () => supabase.auth.signOut(),
  };
}
