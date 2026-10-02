/**
 * Generic Azure AD setup: any organisation tenant + Microsoft first-party public clients
 * (no app registration needed). Graph = Excel / SharePoint files, powerbi = Power BI REST + embed.
 */
export const TENANT_ID = "organizations";

export const RESOURCES = {
  graph: {
    label: "Microsoft 365 (Excel, SharePoint)",
    clientId: "d3590ed6-52b3-4102-aeff-aad2292ab01c", // Microsoft Office
    scope: "https://graph.microsoft.com/.default offline_access openid profile",
  },
  powerbi: {
    label: "Power BI",
    clientId: "ea0616ba-638b-4df5-95b9-636659ae5121", // Power BI
    scope: "https://analysis.windows.net/powerbi/api/.default offline_access openid profile",
  },
} as const;

export type Resource = keyof typeof RESOURCES;

export const PROXY_PORT = 4100;
