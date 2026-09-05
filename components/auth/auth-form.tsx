"use client";
import Link from "next/link";
import { useActionState } from "react";
import { authAction } from "@/app/auth/actions";
const copy = {
  login: {
    title: "Welcome back.",
    detail: "A fresh day. The same commitment to yourself.",
    submit: "Log in",
    footer: "New to CalTrack?",
    link: "/signup",
    linkText: "Create an account",
  },
  signup: {
    title: "Your next chapter.",
    detail: "Create your account. We’ll build your foundation together.",
    submit: "Create account",
    footer: "Already have an account?",
    link: "/login",
    linkText: "Log in",
  },
  forgot: {
    title: "Let’s get you back in.",
    detail: "We’ll email you a link to reset your password.",
    submit: "Send reset link",
    footer: "Remember your password?",
    link: "/login",
    linkText: "Log in",
  },
  reset: {
    title: "A fresh start.",
    detail: "Choose a strong password for your CalTrack account.",
    submit: "Update password",
    footer: "Ready to continue?",
    link: "/login",
    linkText: "Log in",
  },
};
export function AuthForm({
  mode,
  configured,
  initialError,
}: {
  mode: keyof typeof copy;
  configured: boolean;
  initialError?: string;
}) {
  const [state, action, pending] = useActionState(
    authAction.bind(null, mode),
    {},
  );
  const c = copy[mode];
  return (
    <div className="auth-form">
      <span className="eyebrow" style={{ marginBottom: 18 }}>
        MAKE SPACE FOR BETTER
      </span>
      <h1>{c.title}</h1>
      <p className="muted">{c.detail}</p>
      {!configured && (
        <p className="notice warning">
          Account access needs a Supabase connection.{" "}
          <Link href="/setup">View setup</Link>
        </p>
      )}
      <form action={action} className="form-stack">
        {mode !== "reset" && (
          <label className="field">
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
            />
          </label>
        )}
        {mode !== "forgot" && (
          <label className="field">
            {mode === "reset" ? "New password" : "Password"}
            <input
              type="password"
              name="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={12}
              maxLength={128}
              required
              placeholder="At least 12 characters"
            />
            {mode !== "login" && (
              <small>
                Use 12 or more characters, ideally a unique passphrase.
              </small>
            )}
          </label>
        )}
        {mode === "login" && (
          <Link
            className="text-link"
            href="/forgot-password"
            style={{ textAlign: "right" }}
          >
            Forgot password?
          </Link>
        )}
        {(state.error || initialError) && (
          <p className="error-text" role="alert">
            {state.error || initialError}
          </p>
        )}
        {state.success && (
          <p className="notice" role="status">
            {state.success}
          </p>
        )}
        <button className="button primary" disabled={pending || !configured}>
          {pending ? "Just a moment…" : c.submit}
          <span aria-hidden>↗</span>
        </button>
      </form>
      <p className="auth-footer">
        {c.footer} <Link href={c.link}>{c.linkText}</Link>
      </p>
    </div>
  );
}
