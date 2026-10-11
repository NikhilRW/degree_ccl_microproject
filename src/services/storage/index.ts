import { startImageUpload, finishImageUpload } from "@/server/admin.functions";

export const storageService = {
  async uploadFile(file: File) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      throw new Error("Use a JPEG, PNG or WebP image no larger than 5 MB.");
    const signed = await startImageUpload({
      data: { type: file.type as "image/jpeg" | "image/png" | "image/webp", size: file.size },
    });
    const body = new FormData();
    Object.entries(signed.fields).forEach(([key, value]) => body.append(key, value));
    body.append("file", file);
    const response = await fetch(signed.url, { method: "POST", body });
    if (!response.ok) throw new Error("Image upload failed. Check S3 CORS and upload permissions.");
    return finishImageUpload({ data: signed.id });
  },
};
