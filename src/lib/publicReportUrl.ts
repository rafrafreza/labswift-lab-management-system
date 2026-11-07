/** Address printed in the report QR code. Built from the site the PDF is generated on, so it always matches the deployment. */
export function publicReportUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/r/${encodeURIComponent(token)}`;
}
