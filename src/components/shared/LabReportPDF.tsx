// src/components/shared/LabReportPDF.tsx

import { Document, Font, Image, Page, StyleSheet, Text, View, Svg, Polygon } from "@react-pdf/renderer";
import { format } from "date-fns";

import { formatAge, GENDER_LABELS, getRangeText } from "@/lib/utils";
import type { ReportWithRelations } from "@/types";

Font.register({
    family: "Sans",
    fonts: [
        { src: "Serif", fontWeight: 400 },
        { src: "Serif-Bold", fontWeight: 700 },
    ],
});

type SettingsProps = {
    labName: string;
    labAddress: string;
    labPhone: string;
    labEmail: string;
    labWebsite?: string;
    tagline?: string | null;
    logoUrl?: string;
    signatureUrl?: string;
    useSignature?: boolean;
    pathologistName: string;
    pathologistQual: string;
    reportFooter?: string;
    accentColor?: string;
};

type Props = {
    report?: ReportWithRelations;
    reports?: ReportWithRelations[];
    settings: SettingsProps;
};

// ── Layout constants ──────────────────────────────────────────────────────────
const FOOTER_H = 40;
const SIG_H = 65;
const GAP = 10;
const BOTTOM_RESERVED = FOOTER_H + SIG_H + GAP + 15;

function ReportPageContent({
    report,
    settings,
    S,
    fmtDatetime,
    accent,
}: {
    report: ReportWithRelations;
    settings: SettingsProps;
    S: any;
    fmtDatetime: (d: Date | string) => string;
    accent: string;
}) {
    const patientGender = report.patient.gender;

    // Build referred-by string including specialization
    const rawRef = report.patient.refDoctor;
    const doctorObj = (report.patient as any).doctor as {
        name: string; qualification: string | null; specialization: string | null;
    } | null | undefined;

    let refLine = "Self / Walk-in";
    if (rawRef) {
        const base = rawRef.trim().toLowerCase().startsWith("dr.")
            ? rawRef.trim()
            : `Dr. ${rawRef.trim()}`;
        const spec = doctorObj?.specialization?.trim();
        refLine = spec ? `${base}, ${spec}` : base;
    }

    const sections = report.values
        .slice()
        .sort((a, b) => a.field.sortOrder - b.field.sortOrder)
        .reduce((acc, v) => {
            const sec = v.field.section || "Test Results";
            if (!acc[sec]) acc[sec] = [];
            acc[sec].push(v);
            return acc;
        }, {} as Record<string, typeof report.values>);

    const hasAbnormal = report.values.some((v) => v.isAbnormal);

    return (
        <Page size="A4" style={S.page} wrap>
            {/* ── HEADER BAND ────────────────────────────────────────────── */}
            <View style={S.headerBand} fixed>
                <View style={S.headerLeft}>
                    {settings.logoUrl ? (
                        <View style={S.logoStack}>
                            <Image src={settings.logoUrl} style={S.logo} />
                            {settings.tagline?.trim() ? (
                                <Text style={S.logoTagline}>{settings.tagline.trim()}</Text>
                            ) : null}
                        </View>
                    ) : null}
                    <View style={S.labInfo}>
                        <Text style={S.labName}>{settings.labName}</Text>
                        {settings.labAddress ? <Text style={S.labDetail}>{settings.labAddress}</Text> : null}
                        {settings.labPhone ? <Text style={S.labDetail}>Phone: {settings.labPhone}</Text> : null}
                        {settings.labEmail ? <Text style={S.labDetail}>Email: {settings.labEmail}</Text> : null}
                        {settings.labWebsite ? <Text style={S.labDetail}>{settings.labWebsite}</Text> : null}
                    </View>
                </View>

                <View style={S.metaBox}>
                    <Text style={S.reportNumberTitle}>Report Number</Text>
                    <Text style={S.reportNumber}>{report.reportNumber}</Text>
                    <Text style={S.reportDateText}>Collected: {fmtDatetime(report.collectedAt)}</Text>
                    {report.reportedAt && (
                        <Text style={S.reportDateText}>Reported: {fmtDatetime(report.reportedAt)}</Text>
                    )}
                    <View style={S.statusPill}>
                        <Text style={S.statusPillText}>FINAL REPORT</Text>
                    </View>
                </View>
            </View>

            {/* Decorative line below header */}
            <View style={S.headerLine} fixed />

            {/* ── PAGE BODY ──────────────────────────────────────────────── */}
            <View style={S.body}>

                {/* ── PATIENT INFORMATION ──────────────────────────────────── */}
                <View style={S.patientBlock}>
                    <View style={[S.patientRow, { marginBottom: 12 }]}>
                        <View style={S.patientNameCell}>
                            <Text style={S.cellLabel}>Patient Name</Text>
                            <Text style={S.cellValue}>{report.patient.name}</Text>
                        </View>
                        <View style={S.patientIdCell}>
                            <Text style={S.cellLabel}>Patient ID</Text>
                            <Text style={S.cellValue}>{report.patient.patientCode}</Text>
                        </View>
                        <View style={S.patientAgeCell}>
                            <Text style={S.cellLabel}>Age / Gender</Text>
                            <Text style={S.cellValue}>
                                {formatAge(report.patient.age, report.patient.ageMonths, true)} / {GENDER_LABELS[patientGender as keyof typeof GENDER_LABELS]}
                            </Text>
                        </View>
                    </View>

                    <View style={S.patientRow}>
                        <View style={S.patientCell}>
                            <Text style={S.cellLabel}>Referred By</Text>
                            <Text style={S.cellValue}>{refLine}</Text>
                        </View>
                    </View>
                </View>

                {/* ── REPORT TITLE ───────────────────────────────────────────── */}
                <View style={S.titleBlock}>
                    <Text style={S.titleCategory}>{report.template.category} Report</Text>
                </View>

                {/* ── RESULTS TABLE ──────────────────────────────────────────── */}
                {Object.entries(sections).map(([section, values]) => (
                    <View key={section} style={S.resultsGroup}>
                        <View style={S.sectionHeaderRow}>
                            <View style={S.sectionHeaderLeft}>
                                <View style={S.sectionAccent} />
                                <Text style={S.sectionHeaderText}>{section}</Text>
                            </View>
                            {/* <Text style={S.sectionCount}>{values.length} tests</Text> */}
                        </View>

                        {/* Only show standard table headers if there are non-WIDAL fields */}
                        {values.some(v => v.field.fieldType !== "WIDAL") && (
                            <View style={S.tableHeaderRow}>
                                <Text style={[S.colHeaderText, S.colHeaderParam]}>Investigation</Text>
                                <Text style={[S.colHeaderText, S.colHeaderResult]}>Result</Text>
                                <Text style={[S.colHeaderText, S.colHeaderUnit]}>Unit</Text>
                                <Text style={[S.colHeaderText, S.colHeaderRange]}>Reference Range</Text>
                            </View>
                        )}

                        {values.map((v, index) => {
                            const rangeText = getRangeText(v.field, patientGender);
                            const isAbnormal = v.isAbnormal;
                            const altBg = index % 2 !== 0 ? "#f8fafc" : "#ffffff";
                            const rowStyle = isAbnormal 
                                ? S.tableRowAbnormal 
                                : [S.tableRow, { backgroundColor: altBg }];

                            // ── WIDAL MATRIX ──────────────────────────────────────
                            if (v.field.fieldType === "WIDAL") {
                                const ANTIGENS = ["S.TYPHI O", "S.TYPHI H", "S.PARATYPHI AH", "S.PARATYPHI BH"];
                                const DILUTIONS = ["1:20", "1:40", "1:80", "1:160", "1:320"];
                                let grid: Record<string, Record<string, string>> = {};
                                try { grid = JSON.parse(v.value || "{}"); } catch { grid = {}; }

                                return (
                                    <View key={v.id} style={S.widalBlock}>
                                        <View style={S.widalHeader}>
                                            <Text style={S.widalTitle}>{v.field.fieldName}</Text>
                                        </View>
                                        <View style={S.widalColsRow}>
                                            <Text style={S.widalAntigenHdr}>Antigen</Text>
                                            {DILUTIONS.map((d) => (
                                                <Text key={d} style={S.widalColHdr}>{d}</Text>
                                            ))}
                                        </View>
                                        {ANTIGENS.map((antigen, ai) => (
                                            <View key={antigen} style={[
                                                S.widalDataRow,
                                                { backgroundColor: ai % 2 === 0 ? "#ffffff" : "#f8fafc" }
                                            ]}>
                                                <Text style={S.widalDataAntigen}>{antigen}</Text>
                                                {DILUTIONS.map((dilution) => {
                                                    const cell = grid[antigen]?.[dilution] ?? "-";
                                                    const isPos = cell === "+";
                                                    return (
                                                        <Text key={dilution} style={isPos ? S.widalDataCellPos : S.widalDataCellNeg}>
                                                            {cell}
                                                        </Text>
                                                    );
                                                })}
                                            </View>
                                        ))}
                                    </View>
                                );
                            }

                            // ── REGULAR ROW ───────────────────────────────────────
                            const isPositive = v.value === "POSITIVE" || v.value === "REACTIVE";
                            const isNegative = v.value === "NEGATIVE" || v.value === "NON-REACTIVE";

                            const resultStyle = isPositive
                                ? { ...S.colResult, color: "#dc2626" }
                                : isNegative
                                    ? { ...S.colResult, color: "#059669" }
                                    : v.isAbnormal
                                        ? S.colResultAbnormal
                                        : S.colResult;

                            return (
                                <View key={v.id} style={rowStyle}>
                                    <View style={S.paramWrap}>
                                        <View style={v.isAbnormal ? S.abnormalMark : S.normalMark} />
                                        <Text style={v.field.isBold ? S.colParamBold : S.colParam}>
                                            {v.field.fieldName}
                                            {v.isAbnormal ? " *" : ""}
                                        </Text>
                                    </View>
                                    <Text style={resultStyle}>{v.value}</Text>
                                    <Text style={S.colUnit}>{v.field.unit || ""}</Text>
                                    <Text style={S.colRange}>{rangeText || "-"}</Text>
                                </View>
                            );
                        })}
                    </View>
                ))}

                {hasAbnormal && (
                    <Text style={S.legendText}>
                        * Value outside normal reference range. Please consult your physician.
                    </Text>
                )}

                {/* ── CLINICAL NOTES ─────────────────────────────────────────── */}
                {report.notes && (
                    <View style={S.notesBlock}>
                        <Text style={S.notesLabel}>Clinical Notes / Remarks</Text>
                        <Text style={S.notesText}>{report.notes}</Text>
                    </View>
                )}

                {/* ── END OF REPORT ──────────────────────────────────────────── */}
                <View style={S.endRow}>
                    <View style={S.endRule} />
                    <Text style={S.endText}> *** END OF REPORT *** </Text>
                    <View style={S.endRule} />
                </View>

            </View>

            {settings.logoUrl ? <Image src={settings.logoUrl} style={S.watermarkLogo} fixed /> : null}

            {/* ── SIGNATURE BLOCK ────────────────────────────────────────── */}
            <View style={S.sigContainer} fixed>
                <View style={S.sigBox}>
                    {settings.useSignature !== false && settings.signatureUrl ? (
                        <View style={{ height: 38, justifyContent: "flex-end", marginBottom: 3 }}>
                            <Image src={settings.signatureUrl} style={{ height: 36, objectFit: "contain", alignSelf: "flex-start" }} />
                        </View>
                    ) : (
                        <View style={{ height: 38 }} />
                    )}
                    <View style={S.sigTextBlock}>
                        <Text style={S.sigName}>{settings.pathologistName}</Text>
                        <Text style={S.sigQual}>{settings.pathologistQual}</Text>
                    </View>
                </View>

                <View style={S.sigBoxRight}>
                    <View style={{ height: 38 }} />
                    <View style={S.sigTextBlockRight}>
                        <Text style={[S.sigName, { textAlign: "right" }]}>Signature</Text>
                        <Text style={S.sigQualPlaceholder}> </Text>
                    </View>
                </View>
            </View>

            {/* ── FOOTER BACKGROUND GRAPHICS ─────────────────────────────── */}
            <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, zIndex: -1 }}>
                {/* Left Geometric Sweeps (Complimenting the right side) */}
                <Svg height="80" width="250" style={{ position: "absolute", bottom: 0, left: 0 }}>
                    {/* Large sweeping triangle */}
                    <Polygon points="0,15 0,80 220,80" style={{ fill: accent, opacity: 0.04 }} />

                    {/* Medium sweep */}
                    <Polygon points="0,40 0,80 140,80" style={{ fill: accent, opacity: 0.08 }} />

                    {/* Solid corner triangle */}
                    <Polygon points="0,60 0,80 65,80" style={{ fill: accent, opacity: 0.2 }} />
                </Svg>

                {/* Right Geometric Sweeps (Purely Angular) */}
                <Svg height="80" width="300" style={{ position: "absolute", bottom: 0, right: 0 }}>
                    {/* Sweeping faceted triangles */}
                    <Polygon points="300,0 300,80 50,80" style={{ fill: accent, opacity: 0.05 }} />
                    <Polygon points="300,10 300,80 200,80" style={{ fill: accent, opacity: 0.08 }} />
                    <Polygon points="300,30 300,80 120,80" style={{ fill: accent, opacity: 0.1 }} />

                    {/* Solid right-angled triangle in the corner */}
                    <Polygon points="300,55 300,80 260,80" style={{ fill: accent, opacity: 0.25 }} />
                </Svg>
            </View>

            {/* ── FOOTER BAR ─────────────────────────────────────────────── */}
            <View style={S.footerBar} fixed>
                <Text style={S.footerDisclaimer}>
                    {settings.reportFooter ||
                        "This report is electronically generated and is valid only for the sample tested. " +
                        "Results must be interpreted in clinical context by a qualified physician. Not a substitute for clinical diagnosis."}
                </Text>
                <View style={S.footerRight}>
                    <Text
                        style={S.footerPage}
                        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
                    />
                    <Text style={S.footerLabName}>{settings.labName}</Text>
                </View>
            </View>
        </Page>
    );
}

export default function LabReportPDF({ report, reports, settings }: Props) {
    const accent = settings.accentColor || "#0f766e"; // Elegant teal default
    
    // 1. Removed time from format, only date is shown
    const fmtDatetime = (d: Date | string) => format(new Date(d), "dd/MM/yyyy");

    const reportsList = reports && reports.length > 0 
        ? reports 
        : report 
            ? [report] 
            : [];

    if (reportsList.length === 0) {
        return null;
    }

    const reportDate = reportsList[0]?.collectedAt || reportsList[0]?.createdAt || new Date();
    const dateStr = format(new Date(reportDate), "dd-MM");

    const docTitle = reportsList.length === 1
        ? `${reportsList[0].reportNumber} - ${reportsList[0].patient.name}`
        : `${reportsList[0].patient.patientCode} - ${reportsList[0].patient.name} - ${dateStr} - Combined Reports`;

    // ── Stylesheet ──────────────────────────────────────────────────────────────
    const S = StyleSheet.create({
        page: {
            fontFamily: "Helvetica",
            fontSize: 9,
            color: "#1e293b",
            paddingTop: 0,
            paddingBottom: BOTTOM_RESERVED,
            paddingHorizontal: 0,
            backgroundColor: "#ffffff",
        },
        watermarkLogo: {
            position: "absolute",
            top: 315,
            left: 177,
            width: 240,
            height: 240,
            objectFit: "contain",
            opacity: 0.055,
        },

        // ── HEADER ──────────────────────────────────────────────────────────────
        headerBand: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            paddingHorizontal: 36,
            paddingTop: 20,
            paddingBottom: 15,
            backgroundColor: "#ffffff",
        },
        headerLeft: {
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
        },
        logo: {
            width: 55,
            height: 55,
            objectFit: "contain",
        },
        logoStack: {
            width: 75,
            marginRight: 9,
            alignItems: "center",
        },
        logoTagline: {
            marginTop: 4,
            fontSize: 5.8,
            lineHeight: 1.15,
            color: "#64748b",
            textAlign: "center",
            fontFamily: "Helvetica-Bold",
        },
        labInfo: {
            flex: 1,
            justifyContent: "center",
        },
        labName: {
            fontSize: 19,
            fontFamily: "Helvetica-Bold",
            color: accent,
            marginBottom: 4,
            letterSpacing: -0.5,
        },
        // 3. Made lab details bold
        labDetail: {
            fontSize: 9,
            fontFamily: "Helvetica-Bold",
            color: "#475569",
            marginBottom: 2,
            letterSpacing: 0.2
        },

        metaBox: {
            alignItems: "flex-end",
            justifyContent: "center",
        },
        reportNumberTitle: {
            fontSize: 6.5,
            fontFamily: "Helvetica-Bold",
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: 2,
        },
        // 4. Made report number less highlighted (smaller font, normal weight, lighter color)
        reportNumber: {
            fontSize: 9,
            fontFamily: "Helvetica",
            color: "#475569",
            marginBottom: 5,
            letterSpacing: 0.5,
        },
        // 2. Made dates prominent (larger font, bold, darker color)
        reportDateText: { 
            fontSize: 9.5, 
            fontFamily: "Helvetica-Bold", 
            color: "#0f172a", 
            marginBottom: 3 
        },
        statusPill: {
            marginTop: 5,
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: accent,
            borderRadius: 3,
        },
        statusPillText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 1 },

        headerLine: {
            height: 2,
            backgroundColor: accent,
            marginHorizontal: 36,
            // opacity: 1,
        },

        // ── Page body padding ─────────────────────────────────────────────────────
        body: { paddingHorizontal: 36, paddingTop: 15 },

        // ── PATIENT BLOCK ────────────────────────────────────────────────────────
        patientBlock: {
            flexDirection: "column",
            backgroundColor: "#f8fafc",
            borderRadius: 6,
            padding: 12,
            marginBottom: 15,
            borderLeftWidth: 3,
            borderLeftColor: accent,
        },
        patientRow: {
            flexDirection: "row",
        },
        patientCell: {
            flex: 1,
        },
        patientNameCell: {
            flex: 2.1,
            paddingRight: 12,
        },
        patientIdCell: {
            flex: 1.05,
            paddingLeft: 10,
        },
        patientAgeCell: {
            flex: 1.05,
            paddingLeft: 10,
        },
        cellLabel: {
            fontSize: 6.5,
            fontFamily: "Helvetica-Bold",
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 2,
        },
        cellValue: {
            fontSize: 9.5,
            fontFamily: "Helvetica-Bold",
            color: "#0f172a"
        },

        // ── REPORT TITLE ─────────────────────────────────────────────────────────
        titleBlock: {
            marginBottom: 15,
            alignItems: "center",
        },
        titleCategory: {
            fontSize: 14,
            fontFamily: "Helvetica-Bold",
            color: "#0f172a",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            borderBottomWidth: 1.5,
            borderBottomColor: accent,
            paddingBottom: 3,
        },

        // ── RESULTS TABLE ────────────────────────────────────────────────────────
        resultsGroup: {
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "#dbe4ee",
            borderRadius: 7,
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.92)",
        },
        sectionHeaderRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 8,
            paddingHorizontal: 10,
            backgroundColor: "#f8fafc",
            borderBottomWidth: 1,
            borderBottomColor: "#dbe4ee",
        },
        sectionHeaderLeft: {
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
        },
        sectionAccent: {
            width: 3,
            height: 16,
            borderRadius: 2,
            backgroundColor: accent,
            marginRight: 8,
        },
        sectionHeaderText: {
            fontSize: 9.5,
            fontFamily: "Helvetica-Bold",
            color: "#0f172a",
            textTransform: "uppercase",
            letterSpacing: 0.9,
        },
        sectionCount: {
            fontSize: 6.5,
            fontFamily: "Helvetica-Bold",
            color: "#64748b",
            backgroundColor: "#e2e8f0",
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 8,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        tableHeaderRow: {
            flexDirection: "row",
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderBottomWidth: 1,
            borderBottomColor: "#e2e8f0",
            backgroundColor: "#f1f5f9",
        },
        tableRow: {
            flexDirection: "row",
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderBottomWidth: 0.5,
            borderBottomColor: "#edf2f7",
            alignItems: "center",
        },
        tableRowAbnormal: {
            flexDirection: "row",
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderBottomWidth: 0.5,
            borderBottomColor: "#fecaca",
            backgroundColor: "#fff1f2",
            alignItems: "center",
        },
        abnormalMark: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#dc2626",
            marginRight: 6,
        },
        normalMark: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#cbd5e1",
            marginRight: 6,
        },
        paramWrap: { width: "40%", flexDirection: "row", alignItems: "center", paddingRight: 8 },
        colParam: { flex: 1, fontSize: 8.8, color: "#334155", lineHeight: 1.25 },
        colParamBold: { flex: 1, fontSize: 8.8, fontFamily: "Helvetica-Bold", color: "#0f172a", lineHeight: 1.25 },
        colResult: { width: "20%", fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a", paddingRight: 8 },
        colResultAbnormal: { width: "20%", fontSize: 9, fontFamily: "Helvetica-Bold", color: "#dc2626", paddingRight: 8 },
        colUnit: { width: "14%", fontSize: 8, color: "#64748b", paddingRight: 8 },
        colRange: { width: "26%", fontSize: 8, color: "#64748b", lineHeight: 1.25 },
        colHeaderParam: { width: "40%" },
        colHeaderResult: { width: "20%" },
        colHeaderUnit: { width: "14%" },
        colHeaderRange: { width: "26%" },
        colHeaderText: {
            fontSize: 6.8,
            fontFamily: "Helvetica-Bold",
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: 0.75
        },

        legendText: {
            fontSize: 7.5,
            color: "#dc2626",
            marginTop: 8,
            fontStyle: "italic",
        },

        // ── WIDAL MATRIX ─────────────────────────────────────────────────────────
        widalBlock: {
            margin: 10,
            marginTop: 8,
            borderWidth: 1,
            borderColor: "#dbe4ee",
            borderRadius: 6,
            overflow: "hidden",
            backgroundColor: "#ffffff",
        },
        widalHeader: {
            backgroundColor: "#f8fafc",
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderBottomWidth: 1,
            borderBottomColor: "#e2e8f0",
        },
        widalTitle: {
            fontSize: 9,
            fontFamily: "Helvetica-Bold",
            textAlign: "center",
            color: "#0f172a",
            letterSpacing: 0.5,
        },
        widalColsRow: {
            flexDirection: "row",
            backgroundColor: "#f1f5f9",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderBottomWidth: 1,
            borderBottomColor: "#cbd5e1",
        },
        widalColHdr: { width: "13.6%", fontSize: 6.8, fontFamily: "Helvetica-Bold", color: "#475569", textAlign: "center" },
        widalAntigenHdr: { width: "32%", fontSize: 6.8, fontFamily: "Helvetica-Bold", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 },
        widalDataRow: {
            flexDirection: "row",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderBottomWidth: 0.5,
            borderBottomColor: "#e2e8f0",
        },
        widalDataAntigen: { width: "32%", fontSize: 8.5, color: "#334155" },
        widalDataCellPos: { width: "13.6%", fontSize: 9, fontFamily: "Helvetica-Bold", color: "#dc2626", textAlign: "center" },
        widalDataCellNeg: { width: "13.6%", fontSize: 9, color: "#94a3b8", textAlign: "center" },

        // ── CLINICAL NOTES ────────────────────────────────────────────────────────
        notesBlock: {
            marginTop: 15,
            padding: 12,
            backgroundColor: "#fdfefe",
            borderRadius: 6,
            borderLeftWidth: 3,
            borderLeftColor: accent,
        },
        notesLabel: {
            fontSize: 7.5,
            fontFamily: "Helvetica-Bold",
            color: accent,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: 0.8,
        },
        notesText: { fontSize: 8, color: "#64748b", lineHeight: 1.4 },

        // ── END OF REPORT LINE ────────────────────────────────────────────────────
        endRow: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 0 },
        endRule: { flex: 1, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
        endText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#94a3b8", marginHorizontal: 15, letterSpacing: 1.2 },

        // ── SIGNATURE ─────────────────────────────────────────────────────────────
        sigContainer: {
            position: "absolute",
            bottom: FOOTER_H + GAP,
            left: 36,
            right: 36,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
        },
        sigBox: { width: "30%" },
        sigBoxRight: { width: "30%", alignItems: "flex-end" },
        sigLineArea: {
            height: 35,
            borderBottomWidth: 1,
            borderBottomColor: "#cbd5e1",
            marginBottom: 4,
            width: "50%",
            borderStyle: 'dashed',
            justifyContent: "flex-end",
        },
        sigImage: {
            height: 40,
            objectFit: "contain",
            marginBottom: -2,
        },
        sigBlankArea: {
            height: 35,
            borderBottomWidth: 1,
            borderBottomColor: "#cbd5e1",
            marginBottom: 4,
            width: "100%",
        },
        sigTextBlock: {
            height: 24,
        },
        sigTextBlockRight: {
            height: 24,
            alignItems: "flex-end",
        },
        sigName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a" },
        sigQual: { fontSize: 10, color: "#64748b", marginTop: 2 },
        sigQualPlaceholder: { fontSize: 7.5, color: "#64748b", marginTop: 2 },

        // ── FOOTER ───────────────────────────────────────────────────────────────
        footerBar: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: FOOTER_H,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: 36,
            paddingRight: 36,
        },
        footerDisclaimer: {
            flex: 1,
            fontSize: 9,
            color: "#64748b",
            lineHeight: 1.3,
            paddingRight: 25,
        },
        footerRight: { alignItems: "flex-end", minWidth: 90 },
        footerPage: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 2 },
        footerLabName: { fontSize: 7, color: "#64748b" },
    });

    return (
        <Document title={docTitle} author={settings.labName}>
            {reportsList.map((r, idx) => (
                <ReportPageContent
                    key={r.id || `${r.reportNumber}-${idx}`}
                    report={r}
                    settings={settings}
                    S={S}
                    fmtDatetime={fmtDatetime}
                    accent={accent}
                />
            ))}
        </Document>
    );
}
