import { useFormik } from "formik";
import * as Yup from "yup";
import { useMemo, useState } from "react";

import { apiRequest, ensureAvatarUrl } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addPost } from "@/features/posts/redux/postsSlice";
import type { FeedPost } from "@/features/posts/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreatePostFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

const CreatePostSchema = Yup.object({
  caption: Yup.string()
    .trim()
    .min(2, "Caption must be at least 2 characters.")
    .required("Caption is required."),
  location: Yup.string().trim().max(80, "Location is too long.").optional(),
});

function CreatePostForm({ onSuccess, onCancel }: CreatePostFormProps) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const safeAvatar = useMemo(
    () => ensureAvatarUrl(authUser?.avatarUrl),
    [authUser?.avatarUrl],
  );

  const formik = useFormik({
    initialValues: {
      caption: "",
      location: "",
    },
    validationSchema: CreatePostSchema,
    onSubmit: async (values, { setStatus, resetForm, setSubmitting }) => {
      if (!authUser || !authToken) {
        setStatus("You must be logged in.");
        setSubmitting(false);
        return;
      }
      if (!postImageFile) {
        setStatus("Please choose an image.");
        setSubmitting(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("image", postImageFile);
        formData.append("caption", values.caption.trim());
        formData.append("location", values.location.trim());

        const response = await apiRequest<{
          data: {
            post: {
              id: string | number;
              userId: string | number;
              imageUrl: string;
              caption: string | null;
              location: string | null;
            };
          };
        }>("/api/posts", {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: formData,
        });

        const created = response.data.post;
        const newPost: FeedPost = {
          id: String(created.id),
          authorId: String(created.userId),
          username: authUser.username,
          avatarUrl: safeAvatar,
          location: created.location ?? "",
          imageUrl: created.imageUrl,
          likesCount: 0,
          caption: created.caption ?? "",
          commentsCount: 0,
          comments: [],
          postedAtLabel: "JUST NOW",
          isLiked: false,
          isSaved: false,
        };

        dispatch(addPost(newPost));
        resetForm();
        setPostImageFile(null);
        setImagePreviewUrl(null);
        setStatus(undefined);
        onSuccess?.();
      } catch {
        setStatus("Unable to create post right now.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  const fieldError = (name: keyof typeof formik.values) =>
    formik.touched[name] && formik.errors[name] ? formik.errors[name] : undefined;

  return (
    <form className="space-y-4" onSubmit={formik.handleSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="create-image-file">Image</Label>
        <Input
          id="create-image-file"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setPostImageFile(file);
            if (!file) {
              setImagePreviewUrl(null);
              return;
            }
            setImagePreviewUrl(URL.createObjectURL(file));
          }}
        />
        {imagePreviewUrl ? (
          <img
            src={imagePreviewUrl}
            alt="Post preview"
            className="h-40 w-full rounded-md object-cover"
          />
        ) : (
          <p className="text-xs text-zinc-500">Choose JPG, PNG or WEBP image.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-caption">Caption</Label>
        <Input
          id="create-caption"
          name="caption"
          value={formik.values.caption}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          className={fieldError("caption") ? "border-red-500" : ""}
          placeholder="Write a caption..."
        />
        {fieldError("caption") ? (
          <p className="text-xs text-red-600">{fieldError("caption")}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-location">Location (optional)</Label>
        <Input
          id="create-location"
          name="location"
          value={formik.values.location}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          className={fieldError("location") ? "border-red-500" : ""}
          placeholder="Karachi, PK"
        />
        {fieldError("location") ? (
          <p className="text-xs text-red-600">{fieldError("location")}</p>
        ) : null}
      </div>

      {formik.status ? <p className="text-sm text-red-600">{formik.status}</p> : null}
      {formik.isSubmitting ? (
        <p className="text-sm text-zinc-600">Uploading image and creating post...</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Sharing..." : "Share"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={formik.isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default CreatePostForm;
