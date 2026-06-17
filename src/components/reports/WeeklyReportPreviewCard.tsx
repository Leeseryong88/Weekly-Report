import { Star } from "lucide-react";
import { SubmitStatusBadge, TaskStatusBadge } from "@/components/ui/StatusBadge";
import { getReportSections, hasSectionContent, REPORT_SECTIONS } from "@/lib/report-items";
import { cn } from "@/lib/utils";
import type { WeeklyReport } from "@/types";

const SECTION_STYLES = {
  weeklyWorkItems: {
    wrapper: "border-slate-200 bg-white",
    title: "text-slate-800",
    item: "border-slate-100 bg-slate-50",
    label: "업무",
  },
  requestItems: {
    wrapper: "border-blue-100 bg-blue-50",
    title: "text-blue-800",
    item: "border-blue-100 bg-white",
    label: "의사결정",
  },
  deptHeadDirectiveItems: {
    wrapper: "border-amber-100 bg-amber-50",
    title: "text-amber-800",
    item: "border-amber-100 bg-white",
    label: "지시",
  },
  specialNoteItems: {
    wrapper: "border-violet-100 bg-violet-50",
    title: "text-violet-800",
    item: "border-violet-100 bg-white",
    label: "참고",
  },
} as const;

export function WeeklyReportPreviewCard({
  report,
  authorName,
}: {
  report: WeeklyReport;
  authorName: string;
}) {
  const sections = getReportSections(report);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-slate-900">{authorName} 보고</p>
        <SubmitStatusBadge status={report.submitStatus} />
      </div>

      {REPORT_SECTIONS.map((section) => {
        const items = sections[section.key];
        if (section.optional && !hasSectionContent(items)) return null;
        const filled = items.filter((item) => item.content.trim());
        if (filled.length === 0) return null;

        return (
          <div
            key={section.key}
            className={cn("rounded-lg border p-3", SECTION_STYLES[section.key].wrapper)}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  section.key === "weeklyWorkItems" && "bg-slate-200 text-slate-700",
                  section.key === "requestItems" && "bg-blue-100 text-blue-700",
                  section.key === "deptHeadDirectiveItems" && "bg-amber-100 text-amber-700",
                  section.key === "specialNoteItems" && "bg-violet-100 text-violet-700"
                )}
              >
                {SECTION_STYLES[section.key].label}
              </span>
              <p className={cn("text-sm font-semibold", SECTION_STYLES[section.key].title)}>
                {section.label}
              </p>
            </div>
            <ul className="space-y-2">
              {filled.map((item) => {
                const important = item.importance === "high" || item.importance === "urgent";
                const showMeta = section.key === "weeklyWorkItems";

                return (
                  <li
                    key={item.id}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      SECTION_STYLES[section.key].item
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {showMeta && (
                        <>
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                            {important && (
                              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                            )}
                          </span>
                          <TaskStatusBadge
                            status={item.status}
                            className="shrink-0 px-2 py-0.5 text-[11px] font-semibold"
                          />
                        </>
                      )}
                      <p className="min-w-0 whitespace-pre-wrap text-slate-700">
                        {item.directiveOwner?.trim() && (
                          <span className="mr-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            {item.directiveOwner}
                          </span>
                        )}
                        {item.content}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
