/** Generic Azure AD values: any organisation tenant + the public Power BI client (no app registration). */
export const PBI_TENANT_ID = "organizations";
export const PBI_CLIENT_ID = "ea0616ba-638b-4df5-95b9-636659ae5121";
export const PBI_SCOPE = "https://analysis.windows.net/powerbi/api/.default offline_access";
export const PBI_API = "https://api.powerbi.com/v1.0/myorg";
/** Access tokens last ~1 h; we warn a bit earlier. */
export const PBI_TOKEN_TTL_MS = 55 * 60 * 1000;
