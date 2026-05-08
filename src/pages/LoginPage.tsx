import { Link, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { useAppDispatch } from "@/app/hooks";
import { loginSuccess } from "@/features/auth/redux/authSlice";
import type { AuthUser } from "@/features/auth/types";
import type { SocialState } from "@/features/social/types";
import { replaceSocialState } from "@/features/social/redux/socialSlice";

// ── Yup validation schema ──────────────────────────────────────────────────
const LoginSchema = Yup.object({
  identity: Yup.string().trim().required("Enter your username or email."),
  password: Yup.string().required("Password is required."),
});

// ── Main component ─────────────────────────────────────────────────────────
function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotIdentity, setForgotIdentity] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  const formik = useFormik({
    initialValues: { identity: "", password: "" },
    validationSchema: LoginSchema,
    onSubmit: async (values, { setFieldError, setSubmitting }) => {
      try {
        const identity = values.identity.trim();
        let email = identity;

        if (!identity.includes("@")) {
          const profile = await apiRequest<{
            data: { user: { email: string } };
          }>(`/api/users/${encodeURIComponent(identity)}`);
          email = profile.data.user.email;
        }

        const response = await apiRequest<{
          token: string;
          data: { user: Omit<AuthUser, "id"> & { id: number | string } };
        }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email,
            password: values.password,
          }),
        });

        const authUser: AuthUser = {
          id: String(response.data.user.id),
          username: response.data.user.username,
          fullName: response.data.user.fullName,
          email: response.data.user.email,
          avatarUrl: response.data.user.avatarUrl ?? null,
        };

        dispatch(loginSuccess({ user: authUser, token: response.token }));
        try {
          let socialResponse;
          try {
            socialResponse = await apiRequest<{ data: SocialState }>(
              "/api/social/me",
              {
                headers: { Authorization: `Bearer ${response.token}` },
              },
            );
          } catch {
            socialResponse = await apiRequest<{ data: SocialState }>(
              "/api/social/state",
              {
                headers: { Authorization: `Bearer ${response.token}` },
              },
            );
          }
          dispatch(replaceSocialState(socialResponse.data));
        } catch {
          // Keep flow alive even if social pre-hydration fails.
        }
        saveSession(authUser.id, response.token);
        navigate("/");
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.statusCode === 404) {
            setFieldError("identity", "User not found. Please sign up.");
          } else if (error.statusCode === 401) {
            setFieldError("password", "Invalid email or password.");
          } else {
            setFieldError("identity", "Unable to login right now.");
          }
        } else {
          setFieldError("identity", "Unable to login right now.");
        }
      } finally {
        setSubmitting(false);
      }
    },
  });

  const fieldError = (name: keyof typeof formik.values) =>
    formik.touched[name] && formik.errors[name]
      ? formik.errors[name]
      : undefined;

  async function handleForgotPasswordSubmit() {
    const identity = forgotIdentity.trim();
    const newPassword = forgotNewPassword;
    setForgotError("");
    setForgotSuccess("");
    if (!identity) {
      setForgotError("Enter your username or email.");
      return;
    }
    if (!newPassword) {
      setForgotError("Enter your new password.");
      return;
    }
    if (newPassword.length < 6) {
      setForgotError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }

    setIsSendingForgot(true);
    try {
      const response = await apiRequest<{ message: string }>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ identity, newPassword }),
        },
      );
      setForgotSuccess(response.message);
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotSuccess("");
      }, 900);
      setForgotIdentity("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
    } catch (error) {
      if (error instanceof ApiError) {
        setForgotError(error.message || "Unable to send reset request.");
      } else {
        setForgotError("Unable to send reset request.");
      }
    } finally {
      setIsSendingForgot(false);
    }
  }

  return (
    <div className="flex items-start justify-center bg-white border border-zinc-200 lg:border-l-0 rounded-2xl lg:rounded-l-none lg:rounded-r-2xl px-8 py-4 md:col-span-3">
      <div className="w-full space-y-6">
        {/* Wordmark */}
        <div className="flex justify-center">
          <span
            className="text-4xl font-semibold tracking-tight text-zinc-900"
            style={{ fontFamily: "'Grand Hotel', cursive" }}
          >
            Instagram
          </span>
        </div>

        {/* Google font */}
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Grand+Hotel&display=swap');`}</style>

        {/* ── Form fields ─────────────────────────────────────────── */}
        {showForgotPassword ? (
          <div className="space-y-3">
            <div>
              <Input
                id="forgot-identity"
                placeholder="Username or email"
                className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                  forgotError ? "border-red-400 focus-visible:ring-red-300" : ""
                }`}
                autoComplete="username"
                value={forgotIdentity}
                onChange={(e) => setForgotIdentity(e.target.value)}
              />
            </div>
            <div>
              <Input
                id="forgot-new-password"
                type="password"
                placeholder="New password"
                className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                  forgotError ? "border-red-400 focus-visible:ring-red-300" : ""
                }`}
                autoComplete="new-password"
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
              />
            </div>
            <div>
              <Input
                id="forgot-confirm-password"
                type="password"
                placeholder="Confirm new password"
                className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                  forgotError ? "border-red-400 focus-visible:ring-red-300" : ""
                }`}
                autoComplete="new-password"
                value={forgotConfirmPassword}
                onChange={(e) => setForgotConfirmPassword(e.target.value)}
              />
              {forgotError ? (
                <p className="mt-1 text-xs pt-1 text-red-500">{forgotError}</p>
              ) : null}
              {forgotSuccess ? (
                <p className="mt-1 text-xs pt-1 text-green-600">{forgotSuccess}</p>
              ) : null}
            </div>
            <Button
              type="button"
              className="w-full h-9 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-60 cursor-pointer"
              onClick={() => void handleForgotPasswordSubmit()}
              disabled={
                isSendingForgot ||
                !forgotIdentity.trim() ||
                !forgotNewPassword ||
                !forgotConfirmPassword
              }
            >
              {isSendingForgot ? "Updating..." : "Update password"}
            </Button>
            <p className="text-center text-xs text-zinc-500">
              <button
                type="button"
                className="cursor-pointer hover:underline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotError("");
                  setForgotSuccess("");
                }}
              >
                Back to login
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Identity */}
            <div>
              <Input
                id="login-identity"
                placeholder="Mobile number, username or email"
                className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                  fieldError("identity")
                    ? "border-red-400 focus-visible:ring-red-300"
                    : ""
                }`}
                autoComplete="username"
                value={formik.values.identity}
                onChange={formik.handleChange("identity")}
                onBlur={formik.handleBlur("identity")}
              />
              {fieldError("identity") && (
                <p className="mt-1 text-xs pt-1 text-red-500">
                  {fieldError("identity")}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <Input
                id="login-password"
                type="password"
                placeholder="Password"
                className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                  fieldError("password")
                    ? "border-red-400 focus-visible:ring-red-300"
                    : ""
                }`}
                autoComplete="current-password"
                value={formik.values.password}
                onChange={formik.handleChange("password")}
                onBlur={formik.handleBlur("password")}
              />
              {fieldError("password") && (
                <p className="mt-1 pt-1 text-xs text-red-500">
                  {fieldError("password")}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="button"
              className="w-full h-9 text-sm font-semibold bg-blue-400 hover:bg-blue-500 text-white rounded-lg disabled:opacity-60 cursor-pointer"
              onClick={() => formik.handleSubmit()}
              disabled={formik.isSubmitting || !formik.dirty}
            >
              {formik.isSubmitting ? "Logging in…" : "Log in"}
            </Button>

            {/* Forgot password */}
            <p className="text-center text-xs text-zinc-500">
              <button
                type="button"
                className="cursor-pointer hover:underline"
                onClick={() => setShowForgotPassword(true)}
              >
                Forgot password?
              </button>
            </p>
          </div>
        )}

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-200" />
          <span className="text-xs font-semibold text-zinc-400">OR</span>
          <div className="flex-1 h-px bg-zinc-200" />
        </div>

        {/* Log in with Facebook */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-[#385185] hover:text-blue-800 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
          </svg>
          Log in with Facebook
        </button>

        {/* Sign up link */}
        <p className="text-center text-sm text-zinc-600">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-blue-500 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
