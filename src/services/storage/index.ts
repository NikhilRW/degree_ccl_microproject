export interface StorageService {
  uploadFile(file: File, path: string): Promise<{ key: string; url: string }>;
  deleteFile(key: string): Promise<void>;
  getFileUrl(key: string): Promise<string>;
}

/**
 * AWS LEARNING ZONE — Amazon S3 (+ CloudFront)
 * Replace with presigned-URL uploads:
 *   1. Lambda issues a presigned PUT for `s3://$VITE_S3_BUCKET/<path>`
 *   2. Browser PUTs the file directly to S3 (never through your API)
 *   3. Reads are served from CloudFront, not the bucket origin
 * Never ship AWS credentials to the browser.
 */
export const mockStorageService: StorageService = {
  async uploadFile(file, path) {
    const key = `${path.replace(/\/$/, "")}/${Date.now()}-${file.name}`;
    return { key, url: URL.createObjectURL(file) };
  },
  async deleteFile() { /* no-op until S3 is wired up */ },
  async getFileUrl(key) { return `/mock-storage/${key}`; },
};

export const storageService: StorageService = mockStorageService;
