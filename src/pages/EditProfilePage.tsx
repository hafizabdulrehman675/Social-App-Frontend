import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

        await apiRequest<{
          data: {
            user: {
              id: number | string;
              username: string;
              fullName: string;
              email: string;
              avatarUrl: string | null;
            };
          };
        }>("/api/users/me", {
          method: "PUT",
          headers: { Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            fullName: values.fullName.trim(),
            username: u,
            email: e,
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
    <div className="mx-auto w-full px-4 py-8 text-left md:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="" style={{ color: "black", fontSize: "34px" }}>
          Edit profile
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-2 bg-zinc-200 hover:bg-zinc-200 text-zinc-900 hover:text-zinc-900 active:bg-transparent cursor-pointer"
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </div>

      <form className="space-y-5" onSubmit={formik.handleSubmit} noValidate>
        <div className="flex items-center gap-4 rounded-lg border border-zinc-200 p-4">
          <img
            src={currentAvatarUrl}
            alt="Profile avatar preview"
            className="h-16 w-16 rounded-full object-cover"
          />
          <div className="space-y-2">
            <Label htmlFor="edit-avatar">Profile photo</Label>
            <Input
              id="edit-avatar"
              type="file"
              accept="image/*"
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
            <p className="text-xs text-zinc-500">
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
            className={fieldError("fullName") ? "border-destructive" : ""}
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
            className={fieldError("username") ? "border-destructive" : ""}
          />
          {fieldError("username") && (
            <p className="text-xs text-destructive">{fieldError("username")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            name="email"
            type="email"
            autoComplete="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={fieldError("email") ? "border-destructive" : ""}
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
                className={
                  fieldError("currentPassword") ? "border-destructive" : ""
                }
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
                className={
                  fieldError("newPassword") ? "border-destructive" : ""
                }
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
                className={
                  fieldError("confirmNewPassword") ? "border-destructive" : ""
                }
              />
              {fieldError("confirmNewPassword") && (
                <p className="text-xs text-destructive">
                  {fieldError("confirmNewPassword")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            type="submit"
            disabled={formik.isSubmitting}
            className={btnPrimaryStill}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            className={btnOutlineStill}
            onClick={() => navigate("/profile")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default EditProfilePage;
