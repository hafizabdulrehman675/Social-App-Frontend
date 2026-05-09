import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { API_BASE_URL, ApiError, apiRequest } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { updateAuthenticatedUser } from "@/features/auth/redux/authSlice";
import { syncPostAuthorUsername } from "@/features/posts/redux/postsSlice";
import { updateUserProfile } from "@/features/users/redux/usersSlice";

const btnPrimaryStill =
  "bg-zinc-900 text-white hover:bg-zinc-900 hover:text-white active:bg-zinc-900";
const btnOutlineStill =
  "border-zinc-300 bg-white text-zinc-900 hover:bg-white hover:text-zinc-900 active:bg-white";

const EditProfileSchema = Yup.object({
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
  currentPassword: Yup.string().required(
    "Enter your current password to save changes.",
  ),
  newPassword: Yup.string()
    .optional()
    .test(
      "len",
      "New password must be at least 6 characters.",
      (v) => !v || v.length === 0 || v.length >= 6,
    ),
  confirmNewPassword: Yup.string()
    .optional()
    .test("match", "Must match new password.", function (v) {
      const np = this.parent.newPassword as string | undefined;
      if (!np || np.length === 0) return true;
      return v === np;
    }),
  bio: Yup.string()
    .trim()
    .max(500, "Bio must be at most 500 characters.")
    .optional(),
});

function EditProfilePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const currentAvatarUrl = useMemo(() => {
    const fromUpload =
      avatarPreviewUrl ??
      authUser?.avatarUrl ??
      "https://i.pravatar.cc/100?u=fallback";
    if (fromUpload.startsWith("/uploads/")) {
      return `${API_BASE_URL}${fromUpload}`;
    }
    return fromUpload;
  }, [avatarPreviewUrl, authUser?.avatarUrl]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      fullName: authUser?.fullName ?? "",
      username: authUser?.username ?? "",
      email: authUser?.email ?? "",
      bio: authUser?.bio ?? "",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
    validationSchema: EditProfileSchema,
    onSubmit: async (values, { setFieldError, setSubmitting }) => {
      if (!authUser || !authToken) {
        setSubmitting(false);
        return;
      }
      try {
        const u = values.username.trim();
        const e = values.email.trim();
        const newPw =
          values.newPassword.trim().length > 0
            ? values.newPassword.trim()
            : undefined;

        const bioTrimmed = values.bio.trim();

        await apiRequest<{
          data: {
            user: {
              id: number | string;
              username: string;
              fullName: string;
              email: string;
              avatarUrl: string | null;
              bio?: string | null;
            };
          };
        }>("/api/users/me", {
          method: "PUT",
          headers: { Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            fullName: values.fullName.trim(),
            username: u,
            email: e,
            bio: bioTrimmed,
            currentPassword: values.currentPassword,
            newPassword: newPw,
          }),
        });

        let nextAvatarUrl = authUser.avatarUrl;
        if (avatarFile) {
          const formData = new FormData();
          formData.append("avatar", avatarFile);
          const avatarResponse = await apiRequest<{
            data: {
              user: {
                avatarUrl: string | null;
              };
            };
          }>("/api/users/me/avatar", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${authToken}` },
            body: formData,
          });
          nextAvatarUrl = avatarResponse.data.user.avatarUrl;
        }

        dispatch(
          updateUserProfile({
            userId: authUser.id,
            fullName: values.fullName.trim(),
            username: u,
            email: e,
            newPassword: newPw,
            avatarUrl: nextAvatarUrl,
            bio: bioTrimmed.length > 0 ? bioTrimmed : null,
          }),
        );

        if (authUser.username !== u) {
          dispatch(
            syncPostAuthorUsername({
              userId: authUser.id,
              fromUsername: authUser.username,
              toUsername: u,
              avatarUrl: nextAvatarUrl ?? undefined,
            }),
          );
        } else if (nextAvatarUrl !== authUser.avatarUrl) {
          dispatch(
            syncPostAuthorUsername({
              userId: authUser.id,
              toUsername: u,
              avatarUrl: nextAvatarUrl ?? undefined,
            }),
          );
        }

        dispatch(
          updateAuthenticatedUser({
            fullName: values.fullName.trim(),
            username: u,
            email: e,
            avatarUrl: nextAvatarUrl,
            bio: bioTrimmed.length > 0 ? bioTrimmed : null,
          }),
        );

        navigate("/profile");
      } catch (error) {
        if (error instanceof ApiError) {
          const message = error.message.toLowerCase();
          if (message.includes("password")) {
            setFieldError("currentPassword", error.message);
          } else if (message.includes("username")) {
            setFieldError("username", error.message);
          } else if (message.includes("email")) {
            setFieldError("email", error.message);
          }
        }
      } finally {
        setSubmitting(false);
      }
    },
  });

  const fieldError = (name: keyof typeof formik.values) =>
    formik.touched[name] && formik.errors[name]
      ? (formik.errors[name] as string)
      : undefined;

  if (!authUser) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-left">
        <p className="text-sm text-zinc-500">
          Please log in to edit your profile.
        </p>
        <Link
          to="/login"
          className="mt-2 inline-block text-sm font-semibold text-blue-500"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 pb-24 text-left sm:px-5 sm:py-8 md:max-w-xl md:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h2
          style={{ color: "black" }}
          className="text-[18px] font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl md:text-[3rem]"
        >
          Edit profile
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-full shrink-0 rounded-lg bg-zinc-100 px-4 text-zinc-900 hover:bg-zinc-200 sm:w-auto"
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </div>

      <form
        className="space-y-5 sm:space-y-6"
        onSubmit={formik.handleSubmit}
        noValidate
      >
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 sm:flex-row sm:items-center">
          <img
            src={currentAvatarUrl}
            alt="Profile avatar preview"
            className="mx-auto size-20 shrink-0 rounded-full object-cover ring-2 ring-white sm:mx-0 sm:size-16"
          />
          <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
            <Label htmlFor="edit-avatar" className="text-zinc-800">
              Profile photo
            </Label>
            <Input
              id="edit-avatar"
              type="file"
              accept="image/*"
              className="h-auto min-h-8 w-full cursor-pointer text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-300"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setAvatarFile(file);
                if (!file) {
                  setAvatarPreviewUrl(null);
                  return;
                }
                setAvatarPreviewUrl(URL.createObjectURL(file));
              }}
            />
            <p className="text-xs leading-snug text-zinc-500">
              JPG, PNG, WEBP up to 5MB.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-fullName">Full name</Label>
          <Input
            id="edit-fullName"
            name="fullName"
            autoComplete="name"
            value={formik.values.fullName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={cn(
              "h-10 w-full min-w-0 text-base md:text-sm",
              fieldError("fullName") ? "border-destructive" : "",
            )}
          />
          {fieldError("fullName") && (
            <p className="text-xs text-destructive">{fieldError("fullName")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-username">Username</Label>
          <Input
            id="edit-username"
            name="username"
            autoComplete="username"
            value={formik.values.username}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={cn(
              "h-10 w-full min-w-0 text-base md:text-sm",
              fieldError("username") ? "border-destructive" : "",
            )}
          />
          {fieldError("username") && (
            <p className="text-xs text-destructive">{fieldError("username")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-bio">Bio</Label>
          <p className="text-xs text-zinc-500">
            Shown on your profile directly under your name and username.
          </p>
          <textarea
            id="edit-bio"
            name="bio"
            rows={4}
            placeholder="Tell people about yourself…"
            value={formik.values.bio}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={cn(
              "min-h-[100px] w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
              fieldError("bio") && "border-destructive",
            )}
          />
          {fieldError("bio") && (
            <p className="text-xs text-destructive">{fieldError("bio")}</p>
          )}
          <p className="text-right text-xs text-zinc-500 tabular-nums">
            {formik.values.bio.length}/500
          </p>
        </div>

        <div className="space-y-2 border-t border-zinc-200 pt-5">
          <Label htmlFor="edit-email">Email</Label>
          <p className="text-xs text-zinc-500">
            Private — used for login and notifications.
          </p>
          <Input
            id="edit-email"
            name="email"
            type="email"
            autoComplete="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={cn(
              "h-10 w-full min-w-0 text-base md:text-sm",
              fieldError("email") ? "border-destructive" : "",
            )}
          />
          {fieldError("email") && (
            <p className="text-xs text-destructive">{fieldError("email")}</p>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <p className="mb-3 text-sm font-medium text-zinc-800">Password</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-current-password">Current password</Label>
              <Input
                id="edit-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={formik.values.currentPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 min-w-0 text-base md:text-sm",
                  fieldError("currentPassword") ? "border-destructive" : "",
                )}
              />
              {fieldError("currentPassword") && (
                <p className="text-xs text-destructive">
                  {fieldError("currentPassword")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-new-password">New password (optional)</Label>
              <Input
                id="edit-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={formik.values.newPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 min-w-0 text-base md:text-sm",
                  fieldError("newPassword") ? "border-destructive" : "",
                )}
              />
              {fieldError("newPassword") && (
                <p className="text-xs text-destructive">
                  {fieldError("newPassword")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-confirm-password">
                Confirm new password
              </Label>
              <Input
                id="edit-confirm-password"
                name="confirmNewPassword"
                type="password"
                autoComplete="new-password"
                value={formik.values.confirmNewPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                  "h-10 min-w-0 text-base md:text-sm",
                  fieldError("confirmNewPassword") ? "border-destructive" : "",
                )}
              />
              {fieldError("confirmNewPassword") && (
                <p className="text-xs text-destructive">
                  {fieldError("confirmNewPassword")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-6 sm:mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className={cn(
                btnOutlineStill,
                "order-2 h-11 w-full rounded-lg font-semibold sm:order-1 sm:h-10 sm:min-w-[9rem] sm:w-auto",
              )}
              onClick={() => navigate("/profile")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={formik.isSubmitting}
              className={cn(
                btnPrimaryStill,
                "order-1 h-11 w-full rounded-lg font-semibold sm:order-2 sm:h-10 sm:min-w-[9rem] sm:w-auto",
              )}
            >
              {formik.isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default EditProfilePage;
