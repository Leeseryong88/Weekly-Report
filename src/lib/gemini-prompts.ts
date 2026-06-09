import type { WeeklyReport, TeamReport } from "@/types";

export type AiSummaryType =
  | "team_summary"
  | "merge_duplicates"
  | "extract_requests"
  | "classify_risks"
  | "part_summary";

export function buildTeamSummaryPrompt(reports: WeeklyReport[], memberNames: Record<string, string>) {
  const body = reports
    .map(
      (r) =>
        `[${memberNames[r.userId] ?? r.userId}]
이번 주: ${r.thisWeekWork}
다음 주: ${r.nextWeekPlan}
요청: ${r.requests}
특이: ${r.specialNotes}
중요도: ${r.importance} / 상태: ${r.status}`
    )
    .join("\n\n");

  return `당신은 팀 주간보고 취합 전문가입니다. 아래 팀원 보고를 팀 단위 요약으로 정리하세요.
중복 업무는 병합하고, 요청사항과 이슈를 명확히 구분하세요.
한국어로 작성하고, 마크다운 형식으로 출력하세요.

팀원 보고:
${body}

출력 형식:
## 팀 주간 요약
## 주요 성과
## 다음 주 계획
## 요청사항
## 이슈 및 리스크`;
}

export function buildMergePrompt(items: string[]) {
  return `아래 업무 항목들 중 중복되거나 유사한 항목을 병합하세요.
JSON 배열로만 응답하세요. 각 항목: { "merged": "병합된 내용", "originalIndices": [0, 2] }

항목:
${items.map((item, i) => `${i}. ${item}`).join("\n")}`;
}

export function buildExtractRequestsPrompt(text: string) {
  return `아래 텍스트에서 요청사항만 추출하여 bullet list로 정리하세요. 한국어로 작성.

${text}`;
}

export function buildClassifyRisksPrompt(text: string) {
  return `아래 텍스트에서 특이사항과 리스크를 분류하세요. 한국어 마크다운으로 작성.

## 특이사항
## 리스크

원문:
${text}`;
}

export function buildPartSummaryPrompt(
  teamReports: TeamReport[],
  teamNames: Record<string, string>
) {
  const body = teamReports
    .map(
      (r) =>
        `[${teamNames[r.teamId] ?? r.teamId}]
요약: ${r.summary}
요청: ${r.requests}
이슈: ${r.issues}
리스크: ${r.risks}`
    )
    .join("\n\n");

  return `당신은 파트장을 위한 executive summary 작성자입니다.
아래 4개 팀 보고를 파트 전체 요약으로 정리하세요. 한국어 마크다운.

팀 보고:
${body}

출력:
## 파트 전체 요약
## 팀별 핵심
## 주요 요청사항
## 주요 이슈
## 지연 업무`;
}
