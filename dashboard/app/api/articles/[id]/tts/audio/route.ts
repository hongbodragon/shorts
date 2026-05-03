import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get("file");
  if (!filename || filename.includes("..")) {
    return NextResponse.json({ error: "잘못된 파일명" }, { status: 400 });
  }

  const filepath = join(process.cwd(), "..", "data", "audio", filename);
  try {
    const buf = await readFile(filepath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "파일 없음" }, { status: 404 });
  }
}
