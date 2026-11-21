"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

// Google sign-in needs the provider set up in Supabase, so it is opt-in
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<unknown>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  // Keep the session in sync with Supabase auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load the signed in user's row from the profiles table
  useEffect(() => {
    if (!session) return;

    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => setProfile(error ? { error: error.message } : data));
  }, [session]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "");
  };

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else if (!data.session) setMessage("Check your email to confirm the account.");
    else setMessage("");
  };

  const signInWithGoogle = () => {
    supabase.auth.signInWithOAuth({ provider: "google" });
  };

  if (session) {
    return (
      <div className="flex-col flex min-h-screen items-center justify-center gap-4 p-8 font-sans">
        <p>
          Signed in as <strong>{session.user.email}</strong>
        </p>
        <a href="/logout" className="border rounded-md p-2">
          Log out
        </a>
        Profile:
        <pre className="w-full max-w-2xl overflow-auto">{JSON.stringify(profile, null, 2)}</pre>
        Auth info:
        <pre className="w-full max-w-2xl h-120 overflow-scroll">
          {JSON.stringify(session, null, 3)}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex-col flex min-h-screen items-center justify-center gap-4 p-8 font-sans">
      <form onSubmit={signIn} className="flex flex-col gap-2 w-72">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded-md p-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded-md p-2"
          required
        />
        <button type="submit" className="border rounded-md p-2">
          Log in
        </button>
        <button type="button" onClick={signUp} className="border rounded-md p-2">
          Sign up
        </button>
        {googleEnabled && (
          <button type="button" onClick={signInWithGoogle} className="border rounded-md p-2">
            Log in with Google
          </button>
        )}
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
