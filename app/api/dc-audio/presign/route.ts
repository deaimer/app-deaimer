import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { r2Client } from "@/lib/r2";

export async function POST(req: NextRequest) {
  // Verify the caller is a signed-in Firebase user
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as { key?: string; contentType?: string };
  const { key, contentType } = body;

  if (!key || !contentType) {
    return NextResponse.json({ error: "Missing key or contentType" }, { status: 400 });
  }

  if (!["audio/webm", "audio/mp4", "audio/wav"].includes(contentType)) {
    return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
  }

  // Prevent path traversal — only allow the dc-audio/* pattern
  // Key format: dc-audio/{projectId}/{speakerId}/{timestamp}_{rateLabel}.{ext}
  if (!/^dc-audio\/[^/]+\/[^/]+\/\d+(_\d+k)?\.(webm|mp4|wav)$/.test(key)) {
    return NextResponse.json({ error: "Invalid key format" }, { status: 400 });
  }

  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });

  // Presigned URL valid for 5 minutes — enough for any upload
  const presignedUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  return NextResponse.json({ presignedUrl, publicUrl });
}
