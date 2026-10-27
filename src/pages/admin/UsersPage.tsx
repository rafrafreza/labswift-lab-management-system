import { Mail, Shield, Trash2, User, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { inviteUser, listUsers, updateUser } from "@/lib/services/users";
import { ErrorState, getLoadErrorMessage } from "@/components/shared/PageState";
import { formatDate } from "@/lib/utils";
import { cleanName, isValidEmail } from "@/lib/validation";
import type { Profile, Role } from "@/types";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("STAFF");
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setLoadError(getLoadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    const name = cleanName(inviteName);
    if (!email || !name) {
      toast.error("Name and email are required");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (name.length > 100) {
      toast.error("Name is too long (100 characters at most)");
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
      toast.error("A user with this email already exists.");
      return;
    }
    setInviting(true);
    try {
      await inviteUser({ email, name, role: inviteRole });
      toast.success(`Invitation sent to ${email}`);
      setInviteEmail("");
      setInviteName("");
      setShowInvite(false);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(userId: string, role: Role) {
    try {
      await updateUser(userId, { role });
      toast.success("Role updated");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  }

  async function deactivate(userId: string, name: string) {
    if (!window.confirm(`Deactivate ${name}? They will lose access to the app.`)) {
      return;
    }
    try {
      await updateUser(userId, { isActive: false });
      toast.success(`${name} deactivated`);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deactivate user");
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Staff & Users</h1>
          <p className="page-subtitle">
            {users.length} account{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setShowInvite((current) => !current)} className="btn btn-primary">
          <UserPlus className="h-4 w-4" /> Invite Staff
        </button>
      </div>

      {showInvite && (
        <div className="card animate-fade-in border-teal-200 bg-teal-50/30 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Invite New User</h2>
          <form onSubmit={handleInvite} className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input type="text" className="form-input" value={inviteName} maxLength={100} onChange={(event) => setInviteName(event.target.value)} placeholder="Staff member name" />
            </div>
            <div>
              <label className="form-label">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input type="email" className="form-input" value={inviteEmail} maxLength={254} onChange={(event) => setInviteEmail(event.target.value)} placeholder="staff@lab.com" />
            </div>
            <div>
              <label className="form-label">Role</label>
              <select className="form-input" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Role)}>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={inviting} className="btn btn-primary flex-1">
                {inviting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" /> Send Invite
                  </>
                )}
              </button>
              <button type="button" onClick={() => setShowInvite(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            They receive an email with a one-time link to a page where they create their own password. Nothing is shared with you, and they are not signed in until they have set it.
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, index) => (
                  <tr key={index}>
                    {[...Array(6)].map((_, column) => (
                      <td key={column}>
                        <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: column === 5 ? 60 : "75%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={6}>
                    <ErrorState title="Couldn't load users" message={loadError} onRetry={() => void load()} />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-400">No users found.</td>
                </tr>
              ) : (
                users.map((profile) => {
                  const isCurrentUser = profile.id === user?.id;
                  return (
                    <tr key={profile.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                            style={{
                              background: profile.role === "ADMIN" ? "#ccfbf1" : "#f1f5f9",
                              color: profile.role === "ADMIN" ? "#0f766e" : "#64748b",
                            }}
                          >
                            {profile.name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900">{profile.name}</span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-500">{profile.email}</td>
                      <td>
                        <span className={`badge ${profile.role === "ADMIN" ? "badge-admin" : "badge-staff"}`}>
                          {profile.role === "ADMIN" ? (
                            <>
                              <Shield className="h-3 w-3" /> Admin
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3" /> Staff
                            </>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${profile.isActive ? "border border-green-200 bg-green-50 text-green-700" : "border border-slate-200 bg-slate-100 text-slate-500"}`}>
                          {profile.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-xs text-slate-400">{formatDate(profile.createdAt)}</td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          {!isCurrentUser &&
                            (profile.role === "STAFF" ? (
                              <button onClick={() => void changeRole(profile.id, "ADMIN")} title="Promote to Admin" className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-teal-700">
                                <Shield className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button onClick={() => void changeRole(profile.id, "STAFF")} title="Demote to Staff" className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-amber-600">
                                <User className="h-3.5 w-3.5" />
                              </button>
                            ))}
                          {!isCurrentUser && profile.isActive && (
                            <button onClick={() => void deactivate(profile.id, profile.name)} title="Deactivate user" className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
