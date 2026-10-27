// Rules shared by every place a report PDF can be produced.

export const DRAFT_PDF_MESSAGE = "A draft report can't be downloaded. Please make the report final first.";

/** Message for the combined patient PDF, naming the draft reports that were selected. */
export function draftPdfMessage(reportNumbers: string[]) {
  return reportNumbers.length === 1
    ? `${reportNumbers[0]} is a draft and can't be downloaded. Please make it final first.`
    : `${reportNumbers.length} selected reports are drafts (${reportNumbers.join(", ")}) and can't be downloaded. Please make them final first.`;
}
