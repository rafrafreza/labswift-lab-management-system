import { useEffect, useRef, useState, useCallback } from "react";
import { Building2, FileText, Globe, Mail, Palette, Phone, Save, Upload, User, X } from "lucide-react";
import { toast } from "sonner";

import ReportDesignPicker from "@/components/settings/ReportDesignPicker";
import { normalizeReportTemplate } from "@/lib/reportTemplates";
import { BUCKETS, uploadFile } from "@/lib/supabase";
import { getSettings, updateSettings } from "@/lib/services/settings";

type SettingsForm = {
  labName: string;
  labAddress: string;
  labPhone: string;
  labEmail: string;
  labWebsite: string;
  tagline: string;
  reportTemplate: string;
  logoUrl: string;
  signatureUrl: string;
  useSignature: boolean;
  pathologistName: string;
  pathologistQual: string;
  reportNumberPrefix: string;
  reportFooter: string;
  accentColor: string;
};

const DEFAULTS: SettingsForm = {
  labName: "",
  labAddress: "",
  labPhone: "",
  labEmail: "",
  labWebsite: "",
  tagline: "",
  reportTemplate: "modern",
  logoUrl: "",
  signatureUrl: "",
  useSignature: true,
  pathologistName: "",
  pathologistQual: "",
  reportNumberPrefix: "LAB-",
  reportFooter: "",
  accentColor: "#0f766e",
};


  const Section = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
  }) => (
    <div className="card p-6">
      <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800">
        <Icon className="h-4 w-4 text-teal-600" />
        {title}
      </h2>
      {children}
    </div>
  );

  const ImageUploader = ({
    label,
    value,
    uploading,
    inputRef,
    onUpload,
    onClear,
  }: {
    label: string;
    value: string;
    uploading: boolean;
    inputRef: React.RefObject<HTMLInputElement>;
    onUpload: (file: File) => void;
    onClear: () => void;
  }) => (
    <div>
      <label className="form-label">{label}</label>
      {value ? (
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={value} alt={label} className="max-h-full max-w-full object-contain p-2" />
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-secondary btn-sm">
              <Upload className="h-3.5 w-3.5" /> Replace
            </button>
            <button type="button" onClick={onClear} className="btn btn-ghost btn-sm text-red-500">
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-all hover:border-teal-400 hover:bg-teal-50/30 hover:text-teal-600"
        >
          {uploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600" />
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="text-sm font-medium">Click to upload</span>
              <span className="text-xs">PNG, JPG or SVG · Max 2MB</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])}
      />
    </div>
  );


export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings()
      .then((settings) =>
        setForm({
          ...DEFAULTS,
          ...settings,
          labWebsite: settings.labWebsite || "",
          tagline: settings.tagline || "",
          reportTemplate: normalizeReportTemplate(settings.reportTemplate),
          logoUrl: settings.logoUrl || "",
          signatureUrl: settings.signatureUrl || "",
          useSignature: settings.useSignature !== undefined ? Boolean(settings.useSignature) : Boolean(settings.signatureUrl),
          reportFooter: settings.reportFooter || "",
        })
      )
      .finally(() => setLoading(false));
  }, []);

  // ✅ FIX: memoized + prevent unnecessary re-renders
  const update = useCallback((key: keyof SettingsForm, value: string) => {
    setForm((current) => {
      if (current[key] === value) return current;
      return { ...current, [key]: value };
    });
  }, []);

  async function handleUpload(file: File, key: "logoUrl" | "signatureUrl", setUploading: (value: boolean) => void) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large - max 2MB");
      return;
    }
    setUploading(true);
    try {
      const prefix = key === "logoUrl" ? "logo" : "signature";
      const path = `${prefix}-${Date.now()}.${file.name.split(".").pop()}`;
      const url = await uploadFile(BUCKETS.LAB_ASSETS, path, file);
      update(key, url);
      toast.success(`${key === "logoUrl" ? "Logo" : "Signature"} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ✅ FIX: stable handlers
  const handleLogoUpload = useCallback((file: File) => {
    void handleUpload(file, "logoUrl", setUploadingLogo);
  }, []);

  const handleSigUpload = useCallback((file: File) => {
    void handleUpload(file, "signatureUrl", setUploadingSig);
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!form.labName.trim()) {
      toast.error("Lab name is required");
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        labName: form.labName,
        labAddress: form.labAddress,
        labPhone: form.labPhone,
        labEmail: form.labEmail,
        labWebsite: form.labWebsite || null,
        tagline: form.tagline.trim() || null,
        reportTemplate: normalizeReportTemplate(form.reportTemplate),
        logoUrl: form.logoUrl || null,
        signatureUrl: form.signatureUrl || null,
        useSignature: form.useSignature,
        pathologistName: form.pathologistName,
        pathologistQual: form.pathologistQual,
        reportNumberPrefix: form.reportNumberPrefix,
        reportFooter: form.reportFooter || null,
        accentColor: form.accentColor || "#0f766e",
      });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-5">
      <div>
        <h1 className="page-title">Lab Settings</h1>
        <p className="page-subtitle">Configure your lab's branding and report details</p>
      </div>

      <Section title="Lab Identity" icon={Building2}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">
              Lab Name <span className="text-red-500">*</span>
            </label>
            <input type="text" className="form-input" value={form.labName} onChange={(event) => update("labName", event.target.value)} placeholder="e.g. Sharma Pathology Lab" />
          </div>
          <div className="col-span-2">
            <label className="form-label">Tagline (optional)</label>
            <textarea
              rows={2}
              maxLength={80}
              className="form-input resize-none"
              value={form.tagline}
              onChange={(event) => update("tagline", event.target.value)}
              placeholder={"e.g. Precision in Diagnosis,\nCare in Every Slide."}
            />
            <p className="mt-1 text-xs text-slate-400">
              Printed in small text just below the logo, top left of PDF reports. Press Enter for a second line.
              Leave empty for no tagline. Needs a logo to be uploaded.
            </p>
          </div>
          <div className="col-span-2">
            <label className="form-label">Address</label>
            <textarea rows={2} className="form-input resize-none" value={form.labAddress} onChange={(event) => update("labAddress", event.target.value)} placeholder="Full address as it should appear on reports" />
          </div>
          <div>
            <label className="form-label flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              Phone
            </label>
            <input type="tel" className="form-input" value={form.labPhone} onChange={(event) => update("labPhone", event.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="form-label flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Email
            </label>
            <input type="email" className="form-input" value={form.labEmail} onChange={(event) => update("labEmail", event.target.value)} placeholder="reports@lab.com" />
          </div>
          <div className="col-span-2">
            <label className="form-label flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              Website (optional)
            </label>
            <input type="url" className="form-input" value={form.labWebsite} onChange={(event) => update("labWebsite", event.target.value)} placeholder="https://yourlabwebsite.com" />
          </div>
        </div>
      </Section>

      <Section title="Branding & Logo" icon={Palette}>
        <div className="grid grid-cols-2 gap-6">
          <ImageUploader label="Lab Logo" value={form.logoUrl} uploading={uploadingLogo} inputRef={logoInputRef} onUpload={(file) => void handleUpload(file, "logoUrl", setUploadingLogo)} onClear={() => update("logoUrl", "")} />
          <div>
            <label className="form-label">Accent Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.accentColor} onChange={(event) => update("accentColor", event.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5" />
              <input type="text" value={form.accentColor} onChange={(event) => update("accentColor", event.target.value)} className="form-input w-32 font-mono text-sm" placeholder="#0f766e" />
              <span className="text-xs text-slate-400">Used in PDF header and section colors</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["#0f766e", "#1d4ed8", "#7c3aed", "#b91c1c", "#0369a1", "#1e3a5f"].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update("accentColor", color)}
                  title={color}
                  className="h-7 w-7 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110"
                  style={{ background: color, outline: form.accentColor === color ? `2px solid ${color}` : undefined, outlineOffset: "2px" }}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Report Design" icon={FileText}>
        <ReportDesignPicker
          value={form.reportTemplate}
          onChange={(id) => update("reportTemplate", id)}
          accent={form.accentColor || "#0f766e"}
          pdfSettings={{
            labName: form.labName || "Your Lab Name",
            labAddress: form.labAddress,
            labPhone: form.labPhone,
            labEmail: form.labEmail,
            labWebsite: form.labWebsite || undefined,
            tagline: form.tagline,
            logoUrl: form.logoUrl || undefined,
            signatureUrl: form.signatureUrl || undefined,
            useSignature: form.useSignature,
            pathologistName: form.pathologistName || "Pathologist Name",
            pathologistQual: form.pathologistQual,
            reportFooter: form.reportFooter || undefined,
            accentColor: form.accentColor || "#0f766e",
          }}
        />
      </Section>

      <Section title="Pathologist Details" icon={User}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Pathologist Name</label>
            <input type="text" className="form-input" value={form.pathologistName} onChange={(event) => update("pathologistName", event.target.value)} placeholder="Dr. Rajesh Sharma" />
          </div>
          <div>
            <label className="form-label">Qualifications</label>
            <input type="text" className="form-input" value={form.pathologistQual} onChange={(event) => update("pathologistQual", event.target.value)} placeholder="MD Pathology, MBBS" />
          </div>
          <div className="col-span-2 space-y-3">
            <ImageUploader
              label="Digital Signature"
              value={form.signatureUrl}
              uploading={uploadingSig}
              inputRef={sigInputRef}
              onUpload={(file) => void handleUpload(file, "signatureUrl", setUploadingSig)}
              onClear={() => update("signatureUrl", "")}
            />
            <p className="text-xs text-slate-400">
              Upload a clear image of the signature on white background. Recommended: PNG with transparent background.
            </p>

            {/* Checkbox option to include signature on reports */}
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition-all">
              <input
                type="checkbox"
                id="useSignature"
                checked={form.useSignature}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, useSignature: event.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <label htmlFor="useSignature" className="cursor-pointer select-none">
                <span className="block text-sm font-semibold text-slate-800">
                  Use uploaded signature in PDF lab reports
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  When checked, the digital signature will automatically appear above the pathologist's name in PDF reports. Uncheck this if you prefer to sign printed reports by hand.
                </span>
              </label>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Report Configuration" icon={Building2}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Report Number Prefix</label>
            <input type="text" className="form-input font-mono" value={form.reportNumberPrefix} onChange={(event) => update("reportNumberPrefix", event.target.value)} placeholder="LAB-" />
            <p className="mt-1 text-xs text-slate-400">
              Reports will be numbered: <span className="font-mono font-medium">{form.reportNumberPrefix}2026-00001</span>
            </p>
          </div>
          <div className="col-span-2">
            <label className="form-label">Report Footer / Disclaimer</label>
            <textarea rows={2} className="form-input resize-none text-sm" value={form.reportFooter} onChange={(event) => update("reportFooter", event.target.value)} placeholder="This report is electronically generated and does not require a physical signature..." />
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
