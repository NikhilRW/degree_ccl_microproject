import { fileFn, uploadFn } from "@/functions/customer.functions";
import { unwrap } from "../rpc";

export const storageService = {
  async uploadFile(file: File) {
    const policy = await unwrap(() => uploadFn({ data: { name: file.name, contentType: file.type, size: file.size } }));
    const form = new FormData();
    Object.entries(policy.fields).forEach(([key, value]) => form.append(key, value));
    form.append("file", file);
    const response = await fetch(policy.url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error("The file could not be uploaded to S3.");
    return { key: policy.key, url: policy.fileUrl };
  },
  async deleteFile(key: string) {
    await unwrap(() => fileFn({ data: { key, remove: true } }));
  },
  async getFileUrl(key: string) {
    return (await unwrap(() => fileFn({ data: { key, remove: false } }))).url;
  },
};
