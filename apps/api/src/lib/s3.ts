import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || "auto";
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;

export const s3 = new S3Client({
  endpoint,
  region,
  credentials:
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
  forcePathStyle: true,
});

export const S3_BUCKET = process.env.S3_BUCKET as string;

export async function putObject(
  key: string,
  body: ReadableStream | Uint8Array | Buffer,
  contentType?: string,
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body as never,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string) {
  return s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}
