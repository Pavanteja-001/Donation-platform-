import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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

// =================================================================================================
// Deletion
//
// Until this existed, nothing in the platform ever removed a file from the bucket: deleting a
// need, a success story or an event dropped the row and left its images behind forever, and
// *replacing* an image (a new story cover, a new profile photo) orphaned the old one on every
// edit. Object storage is billed on what is stored, not on what is reachable, so that is a bill
// that only ever goes up — for files nothing can ever display again.
// =================================================================================================

/** The folders `createUploadUrl` writes to. Nothing outside these is ever deletable from here. */
const KNOWN_FOLDERS = [
  "contribution-proofs",
  "need-photos",
  "need-qr",
  "kyc-docs",
  "profile-photos",
  "community",
];

/**
 * Public URL → bucket key, or null if this isn't one of our objects.
 *
 * Deliberately strict. A URL column can legitimately hold something we did not upload — an event's
 * `registrationUrl`, a QR image hosted elsewhere, a hand-pasted link — and the cost of being
 * loose here is deleting a stranger's file or, worse, the wrong key in our own bucket. Anything
 * that doesn't match our exact public-URL shape *and* land in a known folder returns null and is
 * silently skipped.
 */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const bucket = env("SUPABASE_S3_BUCKET");
  const endpoint = env("SUPABASE_S3_ENDPOINT");
  if (!bucket || !endpoint) return null;

  let expectedHost: string;
  try {
    expectedHost = new URL(publicBaseUrl(endpoint)).host;
  } catch {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.host !== expectedHost) return null;

  const prefix = `/storage/v1/object/public/${bucket}/`;
  if (!parsed.pathname.startsWith(prefix)) return null;

  const key = decodeURIComponent(parsed.pathname.slice(prefix.length));
  if (!key) return null;
  // `..` can't traverse in an S3 key, but a key that doesn't start with a folder we own is not
  // ours to delete regardless.
  if (!KNOWN_FOLDERS.some((folder) => key.startsWith(`${folder}/`))) return null;
  return key;
}

/**
 * Delete the given public URLs from the bucket. Anything unrecognised is skipped.
 *
 * Fire-and-forget by design, and it swallows its own errors: this runs *after* a row has already
 * been deleted or updated, so failing loudly would turn a successful admin action into a 500 and
 * tempt the caller to retry a delete that already happened. A leaked file is a rounding error on
 * a storage bill; a request that appears to fail after succeeding is a support ticket. Failures
 * are logged, and the sweeper script (prisma/sweepOrphanedUploads.ts) is the backstop that
 * catches whatever this misses.
 *
 * Returns the number of keys actually submitted for deletion, so callers that want to assert in a
 * test can.
 */
export async function deleteObjects(urls: (string | null | undefined)[]): Promise<number> {
  const keys = [...new Set(urls.map(keyFromPublicUrl).filter((k): k is string => k !== null))];
  if (keys.length === 0) return 0;
  try {
    return await deleteKeys(keys);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[storage] Failed to delete ${keys.length} object(s) — they are now orphaned, run prisma/sweepOrphanedUploads.ts:`,
      err instanceof Error ? err.message : err
    );
    return 0;
  }
}

/**
 * Delete by bucket key. Throws on failure — the sweeper wants to know, the request paths above
 * deliberately don't.
 */
export async function deleteKeys(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const bucket = required("SUPABASE_S3_BUCKET");
  const client = getClient();
  // DeleteObjects caps at 1000 keys per call. Nothing in a request path comes close, but the
  // sweeper can, and batching is free.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );
  }
  return keys.length;
}

export interface StoredObject {
  key: string;
  size: number;
  lastModified: Date | null;
}

/** Every object in the bucket, following pagination. Used only by the sweeper script. */
export async function listAllObjects(): Promise<StoredObject[]> {
  const bucket = required("SUPABASE_S3_BUCKET");
  const client = getClient();
  const out: StoredObject[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 })
    );
    for (const item of page.Contents ?? []) {
      if (item.Key) {
        out.push({ key: item.Key, size: item.Size ?? 0, lastModified: item.LastModified ?? null });
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/**
 * Delete whatever `previous` held that `next` no longer does.
 *
 * The replace case, which is the one that leaks constantly: an admin changing a story's cover
 * image four times should not leave three dead files behind. Call it with the before and after
 * values of every URL-bearing field on the row.
 */
export function deleteReplacedObjects(
  previous: (string | null | undefined)[],
  next: (string | null | undefined)[]
): void {
  const kept = new Set(next.filter((u): u is string => !!u));
  const removed = previous.filter((u): u is string => !!u && !kept.has(u));
  if (removed.length > 0) void deleteObjects(removed);
}
