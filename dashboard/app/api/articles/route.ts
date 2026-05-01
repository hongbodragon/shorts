import { NextRequest, NextResponse } from "next/server";
import { getArticlesByStage, updateWorkflowStage } from "@/lib/db";

export async function GET(req: NextRequest) {
  const categoryId = Number(req.nextUrl.searchParams.get("categoryId") ?? 1);
  const grouped = getArticlesByStage(categoryId);
  return NextResponse.json(grouped);
}

export async function PATCH(req: NextRequest) {
  const { articleId, stage } = await req.json();
  updateWorkflowStage(articleId, stage);
  return NextResponse.json({ ok: true });
}
