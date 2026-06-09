import { NextResponse } from "next/server";
import { verifyAuthToken, verifyErrorMessage, canUseAi } from "@/lib/firebase-admin";
import { generateText } from "@/lib/gemini";
import {
  buildTeamSummaryPrompt,
  buildMergePrompt,
  buildExtractRequestsPrompt,
  buildClassifyRisksPrompt,
  buildPartSummaryPrompt,
} from "@/lib/gemini-prompts";
import type { WeeklyReport, TeamReport } from "@/types";

export async function POST(request: Request) {
  const auth = await verifyAuthToken(request.headers.get("Authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: verifyErrorMessage(auth) }, { status: 403 });
  }
  if (!canUseAi(auth.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, payload } = body;
    let prompt = "";

    switch (type) {
      case "team_summary":
        prompt = buildTeamSummaryPrompt(
          payload.reports as WeeklyReport[],
          payload.memberNames as Record<string, string>
        );
        break;
      case "merge_duplicates":
        prompt = buildMergePrompt(payload.items as string[]);
        break;
      case "extract_requests":
        prompt = buildExtractRequestsPrompt(payload.text as string);
        break;
      case "classify_risks":
        prompt = buildClassifyRisksPrompt(payload.text as string);
        break;
      case "part_summary":
        prompt = buildPartSummaryPrompt(
          payload.teamReports as TeamReport[],
          payload.teamNames as Record<string, string>
        );
        break;
      default:
        return NextResponse.json({ error: "알 수 없는 요청 유형" }, { status: 400 });
    }

    const result = await generateText(prompt);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 처리 중 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
