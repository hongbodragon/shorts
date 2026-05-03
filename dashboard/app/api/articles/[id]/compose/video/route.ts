import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  if (!file || file.includes("..")) {
    return NextResponse.json({ error: "잘못된 경로" }, { status: 400 });
  }

  try {
    const buf = await readFile(file);
    const filename = file.split(/[\\/]/).pop() ?? "video.mp4";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "파일 없음" }, { status: 404 });
  }
}
