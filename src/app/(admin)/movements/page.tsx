"use client";
import { useMemo, useState } from "react";
import { api, fmtDate, fmtTime, MovementRecord, today } from "@/lib/api";
import { Empty, ErrorBox, Skeleton, useLoad, useToast } from "@/components/ui";

export default function MovementsHistory() {
  const toast = useToast();
  const [date, setDate] = useState("");
  const [team, setTeam] = useState("");
  const [student, setStudent] = useState("");
  const [regNo, setRegNo] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [markingIn, setMarkingIn] = useState<string | null>(null);

  const { data, error, loading, reload } = useLoad(
    () =>
      api.movements({
        date: date || undefined,
        teamId: team.trim() || undefined,
        student: student.trim() || undefined,
        regNo: regNo.trim() || undefined,
        status: status || undefined,
        reason: reason || undefined,
      }),
    [date, team, student, regNo, status, reason]
  );

  async function handleMarkIn(record: MovementRecord) {
    setMarkingIn(record.id);
    try {
      const res = await api.recordIn(record.memberId);
      toast(`${record.memberName} marked as Inside (Duration: ${res.durationMinutes ?? 0} mins)`);
      reload();
    } catch (e) {
      toast((e as Error).message || "Failed to mark student as Inside", false);
    } finally {
      setMarkingIn(null);
    }
  }

  const rows = useMemo(() => data ?? [], [data]);

  const activeOutsideCount = useMemo(
    () => rows.filter((r) => r.status === "OUT" && !r.inTime).length,
    [rows]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Room Movement / In-Out Tracking</h1>
          <p className="text-xs text-white/60">
            Real-time movement logs, student outside reasons, and duration tracking
          </p>
        </div>
        {activeOutsideCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/40 px-3.5 py-1.5 text-sm font-bold text-red-400">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400 animate-ping" />
            <span>{activeOutsideCount} Student{activeOutsideCount > 1 ? "s" : ""} Currently Outside</span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-6 border border-white/10">
        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-1">Date</label>
          <input
            type="date"
            aria-label="Filter date"
            className="input !py-1.5 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-1">Team</label>
          <input
            className="input !py-1.5 text-sm"
            placeholder="Team ID / Name"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-1">Student</label>
          <input
            className="input !py-1.5 text-sm"
            placeholder="Student Name"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-1">Register Number</label>
          <input
            className="input !py-1.5 text-sm"
            placeholder="Register No"
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-1">Status</label>
          <select
            className="input !py-1.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="OUT">🔴 Currently Outside</option>
            <option value="IN">🟢 Returned / Inside</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-1">Reason</label>
          <select
            className="input !py-1.5 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">All Reasons</option>
            <option value="Washroom">🚻 Washroom</option>
            <option value="Exam">📝 Exam</option>
            <option value="Food">🍴 Food</option>
            <option value="Personal">📞 Personal</option>
            <option value="Other">📋 Other</option>
          </select>
        </div>
      </div>

      {/* Movement Table */}
      {loading ? (
        <Skeleton rows={4} />
      ) : error ? (
        <ErrorBox msg={error} retry={reload} />
      ) : !rows.length ? (
        <Empty msg="No room movement records found for the selected filters." />
      ) : (
        <div className="card overflow-x-auto border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-white/60 text-xs uppercase bg-white/[0.02]">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Student</th>
                <th className="p-3">Register Number</th>
                <th className="p-3">Team</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Out Time</th>
                <th className="p-3">In Time</th>
                <th className="p-3">Duration</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOut = r.status === "OUT" && !r.inTime;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-white/5 transition-colors ${
                      isOut ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="p-3 font-mono text-xs">{fmtDate(r.date)}</td>
                    <td className="p-3 font-semibold text-white">
                      {r.memberName}
                      {r.role === "Leader" && (
                        <span className="ml-1.5 rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] text-orange-400 border border-orange-500/30">
                          Leader
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-white/70">
                      {r.regNo || "—"}
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs text-orange-400 font-medium">
                        {r.teamId}
                      </span>{" "}
                      <span className="text-white/60 text-xs">({r.teamName})</span>
                    </td>
                    <td className="p-3">
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/90">
                        {r.reason}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-white/80">
                      {fmtTime(r.outTime)}
                    </td>
                    <td className="p-3">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/30 animate-pulse">
                          🔴 Outside
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-white/80">
                          {fmtTime(r.inTime)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {isOut ? (
                        <span className="text-xs text-red-400/90 font-semibold">Active</span>
                      ) : (
                        <span className="font-mono text-xs text-green-400 font-medium">
                          {r.durationMinutes ?? 0} mins
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {isOut ? (
                        <button
                          type="button"
                          disabled={markingIn === r.id}
                          className="btn !bg-green-600 hover:!bg-green-500 !px-3 !py-1 text-xs font-bold text-white shadow-sm flex items-center gap-1 ml-auto active:scale-95"
                          onClick={() => handleMarkIn(r)}
                        >
                          {markingIn === r.id ? "Marking IN..." : "🟢 Mark IN"}
                        </button>
                      ) : (
                        <span className="text-xs text-white/30">✓ Returned</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
