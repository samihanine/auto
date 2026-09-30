import * as pbi from "powerbi-client";
import "powerbi-report-authoring";
import type { ReportRef } from "./pbi-api";
import { embedUrl } from "./pbi-api";
import { getPbiToken } from "./pbi-auth";

export { pbi };

const service = new pbi.service.Service(
  pbi.factories.hpmFactory,
  pbi.factories.wpmpFactory,
  pbi.factories.routerFactory,
);

/** Embeds a report with the user's AAD token and resolves once it is loaded. */
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
    accessToken: await getPbiToken(),
    tokenType: pbi.models.TokenType.Aad,
    permissions: editable ? pbi.models.Permissions.ReadWrite : pbi.models.Permissions.Read,
    viewMode: pbi.models.ViewMode.View,
    pageName,
    settings: {
      panes: { filters: { visible: false, expanded: false }, pageNavigation: { visible: true } },
      background: pbi.models.BackgroundType.Transparent,
    },
  }) as pbi.Report;

  await new Promise<void>((resolve, reject) => {
    report.on("loaded", () => resolve());
    report.on("error", (event) => {
      const detail = event.detail as { message?: string; detailedMessage?: string };
      reject(new Error(detail?.detailedMessage ?? detail?.message ?? "Could not load the report"));
    });
  });
  return report;
}

export const resetEmbed = (element: HTMLElement) => service.reset(element);
