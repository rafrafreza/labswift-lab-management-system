import { useEffect, useState } from "react";
import { Pencil, Plus, Stethoscope, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { createDoctor, deleteDoctor, listDoctors, updateDoctor } from "@/lib/services/doctors";
import { ErrorState, getLoadErrorMessage } from "@/components/shared/PageState";
import { cleanName, isValidEmail, isValidPhone } from "@/lib/validation";
import type { Doctor } from "@/types";

type DoctorForm = {
  name: string;
  qualification: string;
  phone: string;
  email: string;
  specialization: string;
  incentiveRate: string;
  isActive: boolean;
};

function emptyForm(): DoctorForm {
  return { name: "", qualification: "", phone: "", email: "", specialization: "", incentiveRate: "50", isActive: true };
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try { setDoctors(await listDoctors()); }
    catch (err) { setLoadError(getLoadErrorMessage(err)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(d: Doctor) {
    setEditing(d);
    setForm({
      name: d.name,
      qualification: d.qualification ?? "",
      phone: d.phone ?? "",
      email: d.email ?? "",
      specialization: d.specialization ?? "",
      incentiveRate: String(d.incentiveRate),
      isActive: d.isActive,
    });
    setShowModal(true);
  }

  async function handleSave() {
    const name = cleanName(form.name.replace(/^dr\.?\s+/i, ""));
    if (!name) { toast.error("Doctor name is required"); return; }
    if (name.length > 100) { toast.error("Doctor name is too long (100 characters at most)"); return; }
    if (form.phone.trim() && !isValidPhone(form.phone)) { toast.error("Enter a valid phone number (7 to 15 digits)"); return; }
    if (form.email.trim() && !isValidEmail(form.email)) { toast.error("Enter a valid email address"); return; }
    const rate = Math.round(parseFloat(form.incentiveRate) * 100) / 100;
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { toast.error("Incentive rate must be between 0 and 100"); return; }

    // The same doctor entered twice splits their referrals and incentives across two records
    const duplicate = doctors.find((d) => d.id !== editing?.id && d.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate && !window.confirm(`A doctor named "Dr. ${duplicate.name}" already exists. Add another one with the same name?`)) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        qualification: form.qualification.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        specialization: form.specialization.trim() || undefined,
        incentiveRate: rate,
        isActive: form.isActive,
      };

      if (editing) {
        await updateDoctor(editing.id, payload);
        toast.success("Doctor updated");
      } else {
        await createDoctor(payload);
        toast.success("Doctor added");
      }
      setShowModal(false);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save doctor");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: Doctor) {
    if (!window.confirm(`Remove Dr. ${d.name}? This will not delete historical reports.`)) return;
    setDeletingId(d.id);
    try {
      await deleteDoctor(d.id);
      toast.success("Doctor removed");
      void load();
    } catch {
      toast.error("Cannot delete — doctor may be linked to existing patients.");
    } finally {
      setDeletingId(null);
    }
  }

  function set(key: keyof DoctorForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Doctors</h1>
          <p className="page-subtitle">Manage referring doctors and incentive rates</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="h-4 w-4" /> Add Doctor
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name & Qualification</th>
              <th>Specialization</th>
              <th>Phone</th>
              <th>Incentive Rate</th>
              <th>Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, c) => (
                  <td key={c}><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                ))}</tr>
              ))
            ) : loadError ? (
              <tr>
                <td colSpan={6}>
                  <ErrorState title="Couldn't load doctors" message={loadError} onRetry={() => void load()} />
                </td>
              </tr>
            ) : doctors.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Stethoscope className="mx-auto mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-sm text-slate-500">No doctors added yet</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Add referring doctors to enable the incentive system.
                  </p>
                </td>
              </tr>
            ) : (
              doctors.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="font-medium text-slate-900">Dr. {d.name}</div>
                    {d.qualification && <div className="text-xs text-slate-400">{d.qualification}</div>}
                  </td>
                  <td className="text-sm text-slate-600">{d.specialization || "—"}</td>
                  <td className="text-sm text-slate-600">{d.phone || "—"}</td>
                  <td>
                    <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-sm font-semibold text-teal-700">
                      {d.incentiveRate}%
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${d.isActive ? "badge-final" : "badge-draft"}`}>
                      {d.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(d)} className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-teal-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {/* <button
                        onClick={() => handleDelete(d)}
                        disabled={deletingId === d.id}
                        className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-red-600"
                      >
                        {deletingId === d.id
                          ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-300 border-t-transparent" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button> */}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-800">
                {editing ? "Edit Doctor" : "Add Doctor"}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon btn-sm">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="form-label">Full Name <span className="text-red-500">*</span></label>
                <input type="text" maxLength={100} className="form-input" value={form.name}
                  onChange={(e) => set("name", e.target.value)} placeholder="e.g. Anand Kumar" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Qualification</label>
                  <input type="text" className="form-input" value={form.qualification}
                    onChange={(e) => set("qualification", e.target.value)} placeholder="MBBS, MD..." />
                </div>
                <div>
                  <label className="form-label">Specialization</label>
                  <input type="text" className="form-input" value={form.specialization}
                    onChange={(e) => set("specialization", e.target.value)} placeholder="Physician..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Phone</label>
                  <input type="tel" maxLength={20} className="form-input" value={form.phone}
                    onChange={(e) => set("phone", e.target.value)} placeholder="+91 ..." />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" maxLength={254} className="form-input" value={form.email}
                    onChange={(e) => set("email", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">
                  Incentive Rate (%)
                  <span className="ml-1 text-xs text-slate-400">— % of test bill amount</span>
                </label>
                <input type="number" min={0} max={100} step={0.5} className="form-input"
                  value={form.incentiveRate} onChange={(e) => set("incentiveRate", e.target.value)} />
              </div>
              {editing && (
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600" />
                  <label htmlFor="isActive" className="text-sm text-slate-700">Active (shows in patient dropdown)</label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Doctor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}