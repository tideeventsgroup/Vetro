import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const UPLOAD_URL_EXPIRY_SECONDS = 300;
const DOWNLOAD_URL_EXPIRY_SECONDS = 300;

let s3Client: S3Client | undefined;

function getS3Client(): S3Client {
  if (!s3Client) s3Client = new S3Client({});
  return s3Client;
}

function requireBucket(): string {
  const bucket = process.env.DOCUMENTS_BUCKET;
  if (!bucket) throw new Error("Missing required env var: DOCUMENTS_BUCKET");
  return bucket;
}

// `prefix` groups uploads by what they belong to — "officers/<id>" for a
// document, "incidents/<officerId>" for an incident photo — the record
// referencing the resulting s3Key doesn't exist yet at upload time (same
// two-step presigned flow either way: get a URL, PUT the file, then create
// the row with the key it returned).
export async function createUploadUrl(params: {
  prefix: string;
  fileName: string;
  contentType: string;
}): Promise<{ uploadUrl: string; s3Key: string }> {
  const s3Key = `${params.prefix}/${randomUUID()}-${params.fileName}`;
  const command = new PutObjectCommand({
    Bucket: requireBucket(),
    Key: s3Key,
    ContentType: params.contentType,
  });
  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: UPLOAD_URL_EXPIRY_SECONDS });
  return { uploadUrl, s3Key };
}

export async function createDownloadUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: requireBucket(), Key: s3Key });
  return getSignedUrl(getS3Client(), command, { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS });
}
