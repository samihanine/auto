import * as pbi from "powerbi-client";
import "powerbi-report-authoring";
import { getToken } from "@repo/microsoft-auth/client";
import type { ReportRef } from "@repo/microsoft-auth/powerbi";
import { embedUrl } from "@repo/microsoft-auth/powerbi";

export { pbi };

const service = new pbi.service.Service(pbi.factories.hpmFactory, pbi.factories.wpmpFactory, pbi.factories.routerFactory);

/** Embeds a report with the user's token and resolves once it is loaded. */
export async function embedReport(
  element: HTMLElement,
  ref: ReportRef,
  { editable = false, pageName }: { editable?: boolean; pageName?: string } = {},
) {
  service.reset(element);
  const report = service.embed(element, {
    type: "report",
    id: ref.reportId,
    embedUrl: embedUrl(ref),
    accessToken: await getToken("powerbi"),
    tokenType: pbi.models.TokenType.Aad,
    permissions: editable ? pbi.models.Permissions.ReadWrite : pbi.models.Permissions.Read,
    viewMode: pbi.models.ViewMode.View,
    pageName,
    settings: {
      panes: { filters: { visible: false, expanded: false }, pageNavigation: { visible: false } },
      background: pbi.models.BackgroundType.Transparent,
    },
  }) as pbi.Report;

  await new Promise<void>((resolve, reject) => {
    report.on("loaded", () => resolve());
    report.on("error", (event) => {
      const detail = event.detail as { message?: string; detailedMessage?: string } | undefined;
      reject(new Error(detail?.detailedMessage ?? detail?.message ?? "Could not load the report"));
    });
  });
  return report;
}

export const resetEmbed = (element: HTMLElement) => service.reset(element);
