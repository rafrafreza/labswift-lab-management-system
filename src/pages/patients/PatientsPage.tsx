import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Search, User } from "lucide-react";
import { Link } from "react-router-dom";

import { listPatients } from "@/lib/services/patients";
import { formatAge, formatDate, GENDER_LABELS } from "@/lib/utils";
import type { Patient } from "@/types";

const PAGE_SIZE = 15;

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPatients({ page, limit: PAGE_SIZE, search: query });
      setPatients(data.patients);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">
            {total} patient{total !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Link to="/patients/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> Add Patient
        </Link>
      </div>

      <div className="card flex items-center gap-3 p-4">
        <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, phone, patient ID..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-xs text-slate-400 hover:text-slate-600">
            Clear
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Age / Gender</th>
                <th>Phone</th>
                <th>Ref. Doctor</th>
                <th>Registered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, index) => (
                  <tr key={index}>
                    {[...Array(7)].map((_, column) => (
                      <td key={column}>
                        <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: column === 6 ? 24 : "80%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <User className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    {query ? `No patients matching "${query}"` : "No patients yet"}
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                        {patient.patientCode}
                      </span>
                    </td>
                    <td>
                      <div className="font-medium text-slate-900">{patient.name}</div>
                      {patient.email && <div className="mt-0.5 text-xs text-slate-400">{patient.email}</div>}
                    </td>
                    <td>
                      {formatAge(patient.age, patient.ageMonths)} · {GENDER_LABELS[patient.gender]}
                    </td>
                    <td className="font-mono text-xs">{patient.phone}</td>
                    <td className="text-slate-500">Dr. {patient.refDoctor || "-"}</td>
                    <td className="text-slate-500">{formatDate(patient.createdAt)}</td>
                    <td>
                      <Link to={`/patients/${patient.id}`} className="btn btn-ghost btn-icon btn-sm">
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <span className="text-xs text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="btn btn-ghost btn-icon btn-sm">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="btn btn-ghost btn-icon btn-sm">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
