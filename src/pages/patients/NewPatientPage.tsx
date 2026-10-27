import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { listDoctors } from "@/lib/services/doctors";
import { validatePatientForm } from "@/lib/validation";
import { createPatient, findDuplicatePatient } from "@/lib/services/patients";
import type { Doctor } from "@/types";
import DoctorSearchSelect from "@/components/shared/DoctorSearchSelect";


function Field({
  label, id, required = false, error, hint, children,
}: {
  label: string; id: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-1 text-xs font-normal text-slate-400">({hint})</span>}
      </label>
      {children}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

export default function NewPatientPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [ageMonths, setAgeMonths] = useState<number | "">("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    listDoctors(true).then(setDoctors).catch(() => {});
  }, []);

  function validate() {
    const e = validatePatientForm({ name, age, ageMonths, phone, email });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Same name + same phone almost always means the patient is already registered
      const duplicate = await findDuplicatePatient({ name, phone });
      if (
        duplicate &&
        !window.confirm(
          `A patient named "${duplicate.name}" with this phone number already exists (${duplicate.patientCode}).\n\nAdd another record anyway?`,
        )
      ) {
        return;
      }

      // Derive refDoctor name from selected doctor
      const selectedDoctor = doctors.find((d) => d.id === doctorId);
      const refDoctor = selectedDoctor
        ? `${selectedDoctor.name}${selectedDoctor.qualification ? `, ${selectedDoctor.qualification}` : ""}`
        : undefined;

      const patient = await createPatient({
        name,
        age: age === "" ? 0 : Number(age),
        ageMonths: ageMonths === "" ? 0 : Number(ageMonths),
        gender,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        refDoctor,
        doctorId: doctorId || undefined,
        bloodGroup: bloodGroup || undefined,
      });
      toast.success(`Patient ${patient.patientCode} created`);
      navigate(`/patients/${patient.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create patient");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/patients" className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </Link>
        <div>
          <h1 className="page-title">Add New Patient</h1>
          <p className="page-subtitle">Fill in the patient details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {/* Personal Info */}
        <div>
          <h2 className="mb-4 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800">
            Personal Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Full Name" id="name" required error={errors.name}>
                <input
                  id="name" type="text" maxLength={100} autoComplete="off"
                  className={`form-input ${errors.name ? "form-input-error" : ""}`}
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar Sharma"
                />
              </Field>
            </div>
            <div>
              <label className="form-label">
                Age <span className="text-red-500">*</span>
                <span className="ml-1 text-xs font-normal text-slate-400">(Years &amp; Months)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    id="age" type="number" min={0} max={150}
                    className={`form-input ${errors.age ? "form-input-error" : ""}`}
                    value={age}
                    onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Years (e.g. 25)"
                  />
                  {errors.age && <p className="form-error">{errors.age}</p>}
                </div>
                <div>
                  <input
                    id="ageMonths" type="number" min={0} max={11}
                    className={`form-input ${errors.ageMonths ? "form-input-error" : ""}`}
                    value={ageMonths}
                    onChange={(e) => setAgeMonths(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Months (0-11)"
                  />
                  {errors.ageMonths && <p className="form-error">{errors.ageMonths}</p>}
                </div>
              </div>
            </div>
            <Field label="Gender" id="gender" required>
              <select id="gender" className="form-input" value={gender}
                onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "OTHER")}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Blood Group" id="bloodGroup">
              <select id="bloodGroup" className="form-input" value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}>
                <option value="">- Select -</option>
                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <h2 className="mb-4 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800">
            Contact Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone Number" id="phone" hint="optional" error={errors.phone}>
              <input
                id="phone" type="tel" maxLength={20} className={`form-input ${errors.phone ? "form-input-error" : ""}`}
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </Field>
            <Field label="Email" id="email" hint="optional" error={errors.email}>
              <input
                id="email" type="email"
                className={`form-input ${errors.email ? "form-input-error" : ""}`}
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@email.com"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Address" id="address" hint="optional">
                <textarea id="address" rows={2} maxLength={300} className="form-input resize-none"
                  value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State, PIN"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Clinical Info */}
        <div>
          <h2 className="mb-4 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800">
            Clinical Details
          </h2>
          <Field label="Referring Doctor" id="doctorId" hint="optional">
            <DoctorSearchSelect
              doctors={doctors}
              value={doctorId}
              onChange={setDoctorId}
            />
            {doctors.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                No doctors added yet.{" "}
                <a href="/admin/doctors" className="text-teal-600 hover:underline">Add doctors</a>{" "}
                in Admin settings.
              </p>
            )}
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
          <Link to="/patients" className="btn btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4" /> Save Patient</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}