import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

// Object storage (CLAUDE.md §6 / D-011) — Supabase Storage via its S3-compatible API. The
// backend never touches image bytes: it signs a short-lived PUT URL, the client uploads
// straight to the bucket, and only the resulting public URL gets stored in the DB.
//
// Read lazily (not thrown at module load) — an incomplete storage config shouldn't crash the
// whole server, only the upload-signing route that actually needs it.
function env(name: string): string | undefined {
  return process.env[name];
}

function required(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(`${name} is not set — check backend/.env (see .env.example)`);
  }
  return value;
}

// Supabase's public object URLs are served from the main project domain
// (https://<ref>.supabase.co), not the S3-compatible one (https://<ref>.storage.supabase.co/...).
function publicBaseUrl(s3Endpoint: string): string {
  const ref = new URL(s3Endpoint).host.split(".")[0];
  return `https://${ref}.supabase.co`;
}

let cachedClient: S3Client | null = null;
function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    endpoint: required("SUPABASE_S3_ENDPOINT"),
    region: required("SUPABASE_S3_REGION"),
    credentials: {
      accessKeyId: required("SUPABASE_S3_ACCESS_KEY_ID"),
      secretAccessKey: required("SUPABASE_S3_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });
  return cachedClient;
}

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface SignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function createUploadUrl(params: { contentType: string; folder: string }): Promise<SignedUpload> {
  const ext = ALLOWED_CONTENT_TYPES[params.contentType];
  if (!ext) {
    throw new Error(`Unsupported content type: ${params.contentType}`);
  }
  const bucket = required("SUPABASE_S3_BUCKET");
  const key = `${params.folder}/${randomUUID()}.${ext}`;

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: params.contentType }),
    { expiresIn: 300 } // 5 minutes — plenty for a client to immediately PUT the file
  );
  const publicUrl = `${publicBaseUrl(required("SUPABASE_S3_ENDPOINT"))}/storage/v1/object/public/${bucket}/${key}`;

  return { uploadUrl, publicUrl, key };
}
