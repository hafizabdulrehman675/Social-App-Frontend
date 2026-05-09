import { Link, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
/*
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
*/
import { Input } from "@/components/ui/input";
/*
import { Label } from "@/components/ui/label";
*/

import { useAppDispatch } from "@/app/hooks";
import { ApiError, apiRequest } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { loginSuccess } from "@/features/auth/redux/authSlice";
import type { AuthUser } from "@/features/auth/types";
import type { SocialState } from "@/features/social/types";
import { replaceSocialState } from "@/features/social/redux/socialSlice";

// ── Yup validation schema ──────────────────────────────────────────────────
const SignupSchema = Yup.object({
  fullName: Yup.string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .required("Full name is required."),
  username: Yup.string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .matches(/^[a-zA-Z0-9_.]+$/, "Only letters, numbers, _ and . allowed.")
    .required("Username is required."),
  email: Yup.string()
    .trim()
    .email("Enter a valid email address.")
    .required("Email is required."),
  password: Yup.string()
    .min(6, "Password must be at least 6 characters.")
    .required("Password is required."),
});

/*
// ── Left‑side decorative phone mockup ─────────────────────────────────────
function PhoneMockup() {
  return (
    <div className="relative w-[260px] h-[380px] select-none">
      <div className="absolute top-6 left-0 w-[210px] h-[340px] rounded-3xl bg-white border border-zinc-200 shadow-2xl rotate-[-6deg] overflow-hidden">
        <div className="w-full h-full bg-gradient-to-br from-pink-100 via-purple-50 to-orange-100" />
      </div>
      <div className="absolute top-0 left-12 w-[210px] h-[360px] rounded-3xl bg-white border border-zinc-200 shadow-2xl overflow-hidden">
        <div className="w-full h-10 bg-zinc-50 flex items-center px-4 gap-2 border-b border-zinc-100">
          <div className="w-2 h-2 rounded-full bg-pink-400" />
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden"
              style={{ height: i === 1 ? 120 : 80 }}
            >
              <div
                className={`w-full h-full ${
                  i === 1
                    ? "bg-gradient-to-br from-rose-300 to-pink-500"
                    : i === 2
                      ? "bg-gradient-to-br from-violet-300 to-purple-500"
                      : "bg-gradient-to-br from-orange-200 to-amber-400"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
*/

// ── Main component ─────────────────────────────────────────────────────────
function SignupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const formik = useFormik({
    initialValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
    },
    validationSchema: SignupSchema,
    onSubmit: async (values, { setFieldError, setSubmitting }) => {
      try {
        const response = await apiRequest<{
          token: string;
          data: { user: Omit<AuthUser, "id"> & { id: number | string } };
        }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username: values.username.trim(),
            fullName: values.fullName.trim(),
            email: values.email.trim(),
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
          const message = error.message.toLowerCase();
          if (message.includes("username")) {
            setFieldError("username", error.message);
          } else if (message.includes("email")) {
            setFieldError("email", error.message);
          } else {
            setFieldError("email", "Unable to signup right now.");
          }
        } else {
          setFieldError("email", "Unable to signup right now.");
        }
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Helper: show error only after field has been touched
  const fieldError = (name: keyof typeof formik.values) =>
    formik.touched[name] && formik.errors[name]
      ? formik.errors[name]
      : undefined;

  return (
    <div className="flex items-start justify-center bg-white border border-zinc-200 lg:border-l-0 rounded-2xl lg:rounded-l-none lg:rounded-r-2xl px-8 py-4 md:col-span-3">
      <div className="w-full space-y-6">
        {/* Instagram wordmark */}
        <div className="flex justify-center">
          <span
            className="text-4xl font-semibold tracking-tight text-zinc-900"
            style={{ fontFamily: "'Grand Hotel', cursive" }}
          >
            Instagram
          </span>
        </div>

        <p className="text-center text-sm font-semibold text-zinc-500 px-4 pb-4">
          Sign up to see photos and videos from your friends.
        </p>

        {/* Google font for wordmark */}
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Grand+Hotel&display=swap');`}</style>

        {/* ── Form ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Full name */}
          <div className="flex gap-1.5">
            <Input
              id="signup-fullname"
              autoComplete="name"
              placeholder="Full name"
              className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                fieldError("fullName")
                  ? "border-red-400 focus-visible:ring-red-300"
                  : ""
              }`}
              value={formik.values.fullName}
              onChange={formik.handleChange("fullName")}
              onBlur={formik.handleBlur("fullName")}
            />
            {fieldError("fullName") && (
              <p className="mt-1 text-sm text-red-500">
                {fieldError("fullName")}
              </p>
            )}
          </div>

          {/* Username */}
          <div className="flex gap-1.5">
            <Input
              id="signup-username"
              autoComplete="username"
              placeholder="Username"
              className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                fieldError("username")
                  ? "border-red-400 focus-visible:ring-red-300"
                  : ""
              }`}
              value={formik.values.username}
              onChange={formik.handleChange("username")}
              onBlur={formik.handleBlur("username")}
            />
            {fieldError("username") && (
              <p className="mt-1 text-sm text-red-500">
                {fieldError("username")}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="flex gap-1.5">
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="Mobile number or email"
              className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                fieldError("email")
                  ? "border-red-400 focus-visible:ring-red-300"
                  : ""
              }`}
              value={formik.values.email}
              onChange={formik.handleChange("email")}
              onBlur={formik.handleBlur("email")}
            />
            {fieldError("email") && (
              <p className="mt-1 text-sm text-red-500">{fieldError("email")}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex gap-1.5">
            <Input
              id="signup-password"
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              className={`bg-zinc-50 border-zinc-300 text-sm h-10 ${
                fieldError("password")
                  ? "border-red-400 focus-visible:ring-red-300"
                  : ""
              }`}
              value={formik.values.password}
              onChange={formik.handleChange("password")}
              onBlur={formik.handleBlur("password")}
            />
            {fieldError("password") && (
              <p className="mt-1 text-sm text-red-500">
                {fieldError("password")}
              </p>
            )}
          </div>

          {/* Terms notice */}
          <p className="text-center text-xs text-zinc-500 px-2 pb-4">
            By signing up, you agree to our{" "}
            <span className="font-semibold text-zinc-700 cursor-pointer hover:underline">
              Terms
            </span>
            ,{" "}
            <span className="font-semibold text-zinc-700 cursor-pointer hover:underline">
              Privacy Policy
            </span>{" "}
            and{" "}
            <span className="font-semibold text-zinc-700 cursor-pointer hover:underline">
              Cookies Policy
            </span>
            .
          </p>

          {/* Submit */}
          <Button
            type="button"
            className="w-full h-9 text-sm font-semibold bg-blue-400 hover:bg-blue-500 text-white rounded-lg disabled:opacity-60 cursor-pointer"
            onClick={() => formik.handleSubmit()}
            disabled={formik.isSubmitting || !formik.dirty}
          >
            {formik.isSubmitting ? "Signing up…" : "Sign up"}
          </Button>
        </div>

        {/* ── Divider ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-200" />
          <span className="text-xs font-semibold text-zinc-400">OR</span>
          <div className="flex-1 h-px bg-zinc-200" />
        </div>

        {/* Log in with Facebook */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-[#385185] hover:text-blue-800 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
          </svg>
          Log in with Facebook
        </button>

        {/* Already have account */}
        <p className="text-center text-sm text-zinc-600">
          Have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-blue-500 hover:underline cursor-pointer"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
