import { AwsClient } from "aws4fetch";
import fs from "node:fs/promises";
import path from "node:path";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const sourceDir = process.env.R2_SOURCE_DIR || "./migration-assets";

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error("Missing R2 credentials. Check .env.example.");
  process.exit(1);
}

const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return files.flat();
}

async function uploadFile(filePath) {
  const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${relativePath}`;
  const response = await client.fetch(url, {
    method: "PUT",
    body: await fs.readFile(filePath),
    headers: { "content-type": "application/octet-stream" }
  });
  if (!response.ok) throw new Error(`Upload failed for ${relativePath}: ${response.status} ${await response.text()}`);
  console.log(`Uploaded ${relativePath}`);
}

for (const filePath of await walk(sourceDir)) {
  await uploadFile(filePath);
}
console.log(`Done uploading files to ${bucketName}.`);
