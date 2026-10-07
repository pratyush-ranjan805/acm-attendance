"use client";
import { useState, useMemo, useCallback } from "react";
import { api, ClubMember, today, fmtTime, Status } from "@/lib/api";
import { useLoad, Skeleton, ErrorBox, Empty, useToast, DateSelector, ConfirmDialog } from "@/components/ui";

/* ─── Add / Edit Modal ─── */
function MemberModal({
  open,
  member,
  onClose,
  onSaved,
}: {
  open: boolean;
  member?: ClubMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(member?.name || "");
  const [regNo, setRegNo] = useState(member?.registerNo || "");
  const [role, setRole] = useState(member?.role || "Member");
  const [dept, setDept] = useState(member?.department || "");
  const [saving, setSaving] = useState(false);

  const isEdit = !!member;

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast("Name is required.", false);
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateClubMember(member!.id, {
          name: name.trim(),
          registerNo: regNo.trim() || undefined,
          role: role.trim() || "Member",
          department: dept.trim() || undefined,
        });
        toast("Member updated ✅");
      } else {
        await api.addClubMember({
          name: name.trim(),
          registerNo: regNo.trim() || undefined,
          role: role.trim() || "Member",
          department: dept.trim() || undefined,
        });
        toast("Member added ✅");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, false);
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit Club Member" : "Add Club Member"}
    >
      <div className="card w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold">
          {isEdit ? "✏️ Edit Club Member" : "➕ Add Club Member"}
        </h3>

        <div>
          <label className="block text-xs text-white/60 mb-1">Name *</label>
          <input
            className="input"
            placeholder="Enter member name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">Register Number</label>
          <input
            className="input"
            placeholder="e.g. 2024CSE001"
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Member">Member</option>
            <option value="Lead">Lead</option>
            <option value="Core">Core</option>
            <option value="Volunteer">Volunteer</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">Department</label>
          <input
            className="input"
            placeholder="e.g. CSE, ECE"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Member Row ─── */
function MemberRow({
  m,
  onToggle,
  onEdit,
  onDelete,
  toggling,
}: {
  m: ClubMember;
  onToggle: (id: string, status: Status) => void;
  onEdit: (m: ClubMember) => void;
  onDelete: (m: ClubMember) => void;
  toggling: string | null;
}) {
  const isPresent = m.status === "Present";
  const isAbsent = m.status === "Absent";

  return (
    <div className="border-b border-white/5 px-4 py-3 last:border-0 space-y-2">
      {/* Top row: status dot + name + role */}
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">
          {isPresent ? (
            <span className="inline-block w-3 h-3 rounded-full bg-green-400 shadow-md shadow-green-400/30" />
          ) : isAbsent ? (
            <span className="inline-block w-3 h-3 rounded-full bg-red-400 shadow-md shadow-red-400/30" />
          ) : (
            <span className="inline-block w-3 h-3 rounded-full bg-white/20" />
          )}
        </div>
        <span className="font-medium text-sm">{m.name}</span>
        <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-white/10 text-white/60">
          {m.role}
        </span>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-white/50 pl-5">
        {m.registerNo && <span>📋 {m.registerNo}</span>}
        {m.department && <span>🏫 {m.department}</span>}
        {m.markedAt && <span>⏰ {fmtTime(m.markedAt)}</span>}
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-1.5 pl-5">
        <button
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            isPresent
              ? "bg-green-500/20 text-green-300 border border-green-500/30"
              : "bg-white/5 text-white/50 border border-white/10 hover:bg-green-500/10 hover:text-green-300 hover:border-green-500/30"
          }`}
          onClick={() => onToggle(m.id, "Present")}
          disabled={toggling === m.id}
        >
          {toggling === m.id ? "..." : "✅ Present"}
        </button>
        <button
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            isAbsent
              ? "bg-red-500/20 text-red-300 border border-red-500/30"
              : "bg-white/5 text-white/50 border border-white/10 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30"
          }`}
          onClick={() => onToggle(m.id, "Absent")}
          disabled={toggling === m.id}
        >
          {toggling === m.id ? "..." : "❌ Absent"}
        </button>
        <button
          className="rounded-lg px-2 py-1.5 text-xs text-white/40 hover:text-white hover:bg-white/5 transition"
          onClick={() => onEdit(m)}
          title="Edit member"
        >
          ✏️
        </button>
        <button
          className="rounded-lg px-2 py-1.5 text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
          onClick={() => onDelete(m)}
          title="Delete member"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ClubPage() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<ClubMember | null>(null);
  const [delTarget, setDelTarget] = useState<ClubMember | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data, error, loading, reload } = useLoad(
    () => api.clubMembers({ date, search: search.trim() || undefined, role: roleFilter || undefined }),
    [date, search, roleFilter]
  );

  const members = data || [];

  const stats = useMemo(() => {
    const total = members.length;
    const present = members.filter((m) => m.status === "Present").length;
    const absent = members.filter((m) => m.status === "Absent").length;
    const unmarked = total - present - absent;
    return { total, present, absent, unmarked };
  }, [members]);

  const handleToggle = useCallback(
    async (memberId: string, status: Status) => {
      setToggling(memberId);
      try {
        await api.saveClubAttendance({
          date,
          records: [{ memberId, status }],
        });
        toast(`Marked as ${status} ✅`);
        reload();
      } catch (e) {
        toast((e as Error).message, false);
      }
      setToggling(null);
    },
    [date, toast, reload]
  );

  const handleMarkAll = useCallback(
    async (status: Status) => {
      if (!members.length) return;
      try {
        await api.saveClubAttendance({
          date,
          records: members.map((m) => ({ memberId: m.id, status })),
        });
        toast(`All marked ${status} ✅`);
        reload();
      } catch (e) {
        toast((e as Error).message, false);
      }
    },
    [date, members, toast, reload]
  );

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      await api.deleteClubMember(delTarget.id);
      toast("Member deleted 🗑️");
      setDelTarget(null);
      reload();
    } catch (e) {
      toast((e as Error).message, false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🎭 Club Members</h1>
          <p className="text-xs text-white/60">
            Manage club members and track their attendance
          </p>
        </div>
        <button className="btn flex items-center gap-1.5 text-sm" onClick={() => setAddOpen(true)}>
          ➕ Add Club Member
        </button>
      </div>

      {/* Date Selector */}
      <DateSelector value={date} onChange={setDate} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-white/60">Total Members</p>
          <p className="mt-1 text-2xl font-bold text-acm">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-white/60">Present</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{stats.present}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-white/60">Absent</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{stats.absent}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-white/60">Unmarked</p>
          <p className="mt-1 text-2xl font-bold text-white/40">{stats.unmarked}</p>
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input flex-1 min-w-[200px]"
            placeholder="🔍 Search by name, register no, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="Lead">Lead</option>
            <option value="Core">Core</option>
            <option value="Member">Member</option>
            <option value="Volunteer">Volunteer</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost !text-xs !px-3 !py-1.5 hover:!bg-green-500/10 hover:!text-green-300"
              onClick={() => handleMarkAll("Present")}
              disabled={!members.length}
            >
              ✅ Mark All Present
            </button>
            <button
              className="btn-ghost !text-xs !px-3 !py-1.5 hover:!bg-red-500/10 hover:!text-red-300"
              onClick={() => handleMarkAll("Absent")}
              disabled={!members.length}
            >
              ❌ Mark All Absent
            </button>
          </div>
        </div>
      </div>

      {/* Members List */}
      {loading ? (
        <Skeleton rows={5} />
      ) : error ? (
        <ErrorBox msg={error} retry={reload} />
      ) : !members.length ? (
        <Empty msg="No club members found. Click '➕ Add Club Member' to get started." />
      ) : (
        <div className="card overflow-hidden">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              m={m}
              onToggle={handleToggle}
              onEdit={(member) => setEditMember(member)}
              onDelete={(member) => setDelTarget(member)}
              toggling={toggling}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {addOpen && (
        <MemberModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={reload}
        />
      )}

      {/* Edit Modal */}
      {editMember && (
        <MemberModal
          open={!!editMember}
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={reload}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!delTarget}
        title="Delete Club Member"
        text={`Are you sure you want to delete "${delTarget?.name}"? This will also remove all their attendance records.`}
        onYes={handleDelete}
        onNo={() => setDelTarget(null)}
      />
    </div>
  );
}
