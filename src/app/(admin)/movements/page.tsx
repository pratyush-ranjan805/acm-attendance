"use client";
import { useMemo, useState } from "react";
import { api, fmtDate, fmtTime, Member, MovementRecord, Team, today } from "@/lib/api";
import { Empty, ErrorBox, Skeleton, useLoad, useToast } from "@/components/ui";
import { RoomOutModal } from "@/components/RoomOutModal";

export default function MovementsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"mark" | "logs">("mark");

  // Search & Filters for Mark Movement Tab
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "OUT" | "IN">("");
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  // Search & Filters for Logs Tab
  const [logDate, setLogDate] = useState("");
  const [logTeam, setLogTeam] = useState("");
  const [logStudent, setLogStudent] = useState("");
  const [logRegNo, setLogRegNo] = useState("");
  const [logStatus, setLogStatus] = useState("");
  const [logReason, setLogReason] = useState("");

  // Action states
  const [outMember, setOutMember] = useState<{ member: Member; teamName: string; teamId: string } | null>(null);
  const [markingInId, setMarkingInId] = useState<string | null>(null);

  // Load Teams and their members
  const {
    data: teams,
    error: teamsError,
    loading: teamsLoading,
    reload: reloadTeams,
  } = useLoad(() => api.teams(), []);

  // Load Movement logs
  const {
    data: logs,
    error: logsError,
    loading: logsLoading,
    reload: reloadLogs,
  } = useLoad(
    () =>
      api.movements({
        date: logDate || undefined,
        teamId: logTeam.trim() || undefined,
        student: logStudent.trim() || undefined,
        regNo: logRegNo.trim() || undefined,
        status: logStatus || undefined,
        reason: logReason || undefined,
      }),
    [logDate, logTeam, logStudent, logRegNo, logStatus, logReason]
  );

  const refreshAll = () => {
    reloadTeams();
    reloadLogs();
  };

  // Mark IN handler
  async function handleMarkIn(memberId: string, memberName: string) {
    setMarkingInId(memberId);
    try {
      const res = await api.recordIn(memberId);
      toast(`🟢 ${memberName} is back Inside (Duration: ${res.durationMinutes ?? 0} mins)`);
      refreshAll();
    } catch (e) {
      toast((e as Error).message || "Failed to mark student as Inside", false);
    } finally {
      setMarkingInId(null);
    }
  }

  // Active outside members across all teams
  const activeOutsideList = useMemo(() => {
    if (!teams) return [];
    const list: { member: Member; team: Team }[] = [];
    for (const t of teams) {
      for (const m of t.members) {
        if (m.movementStatus === "Outside") {
          list.push({ member: m, team: t });
        }
      }
    }
    return list;
  }, [teams]);

  // Total student count
  const totalStudents = useMemo(() => {
    if (!teams) return 0;
    return teams.reduce((acc, t) => acc + (t.members?.length || 0), 0);
  }, [teams]);

  // Filtered teams list for Mark Movement Tab
  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    const q = search.trim().toLowerCase();

    return teams
      .map((t) => {
        // Filter members inside team
        const matchingMembers = t.members.filter((m) => {
          // Status filter
          if (filterStatus === "OUT" && m.movementStatus !== "Outside") return false;
          if (filterStatus === "IN" && m.movementStatus === "Outside") return false;

          if (!q) return true;
          const matchName = m.name.toLowerCase().includes(q);
          const matchEmail = (m.email || "").toLowerCase().includes(q);
          const matchPhone = (m.phone || "").toLowerCase().includes(q);
          const matchTeamId = t.teamId.toLowerCase().includes(q);
          const matchTeamName = t.name.toLowerCase().includes(q);
          return matchName || matchEmail || matchPhone || matchTeamId || matchTeamName;
        });

        // Team matches if specific team filter matches OR matching members found
        const teamMatchesFilter = !filterTeam || t.teamId === filterTeam || t.name === filterTeam;

        return {
          ...t,
          filteredMembers: matchingMembers,
          matches: teamMatchesFilter && (matchingMembers.length > 0 || (!q && !filterStatus)),
        };
      })
      .filter((t) => t.matches);
  }, [teams, search, filterTeam, filterStatus]);

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: prev[teamId] === undefined ? false : !prev[teamId],
    }));
  };

  const expandAll = () => {
    if (!teams) return;
    const next: Record<string, boolean> = {};
    teams.forEach((t) => (next[t.teamId] = true));
    setExpandedTeams(next);
  };

  const collapseAll = () => {
    if (!teams) return;
    const next: Record<string, boolean> = {};
    teams.forEach((t) => (next[t.teamId] = false));
    setExpandedTeams(next);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>🚪</span> Room Movement / In-Out Tracking
          </h1>
          <p className="text-xs text-white/60 mt-1">
            Track student movement in/out of the hall with real-time reasons and durations.
          </p>
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/80">
            <span className="text-white/50">Teams:</span> <strong className="text-white">{teams?.length || 0}</strong>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/80">
            <span className="text-white/50">Students:</span> <strong className="text-white">{totalStudents}</strong>
          </div>
          <div
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold border transition-all ${
              activeOutsideList.length > 0
                ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
                : "bg-green-500/10 border-green-500/30 text-green-400"
            }`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${activeOutsideList.length > 0 ? "bg-red-400 animate-ping" : "bg-green-400"}`} />
            <span>
              {activeOutsideList.length > 0
                ? `${activeOutsideList.length} Outside`
                : "All Students Inside 🟢"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => setActiveTab("mark")}
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "mark"
              ? "border-orange-500 text-orange-400"
              : "border-transparent text-white/60 hover:text-white"
          }`}
        >
          <span>👥</span> Mark Movement (Teams & Members)
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "logs"
              ? "border-orange-500 text-orange-400"
              : "border-transparent text-white/60 hover:text-white"
          }`}
        >
          <span>📋</span> Movement History & Logs
          {logs && logs.length > 0 && (
            <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
              {logs.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: MARK MOVEMENT (TEAMS & MEMBERS) */}
      {activeTab === "mark" && (
        <div className="space-y-5">
          {/* Active Outside Quick Action Banner */}
          {activeOutsideList.length > 0 && (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-red-400">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>Currently Outside ({activeOutsideList.length} Student{activeOutsideList.length > 1 ? "s" : ""})</span>
                </div>
                <span className="text-xs text-white/50">Click &apos;Mark IN&apos; when they return</span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {activeOutsideList.map(({ member, team }) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-black/40 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-sm text-white">{member.name}</p>
                        {member.role === "Leader" && (
                          <span className="rounded bg-orange-500/20 px-1.5 py-0.2 text-[9px] font-bold text-orange-400 border border-orange-500/30">
                            L
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/60 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-orange-400">{team.teamId}</span> · {team.name}
                        {member.phone && (
                          <span className="text-green-400 font-mono">· 📞 {member.phone}</span>
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/30">
                          🔴 {member.activeMovement?.reason || "Outside"}
                        </span>
                        {member.activeMovement?.outTime && (
                          <span className="font-mono text-[10px] text-white/50">
                            since {fmtTime(member.activeMovement.outTime)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {member.phone && (
                        <a
                          href={`tel:${member.phone.trim()}`}
                          className="btn !bg-green-500/20 hover:!bg-green-500/30 border border-green-500/40 !px-2.5 !py-1.5 text-xs font-semibold text-green-400 active:scale-95 transition-all shadow-sm"
                          title={`Call ${member.name}`}
                          aria-label={`Call ${member.name}`}
                        >
                          <span>📞</span>
                          <span className="hidden sm:inline">Call</span>
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={markingInId === member.id}
                        onClick={() => handleMarkIn(member.id, member.name)}
                        className="btn !bg-green-600 hover:!bg-green-500 !px-3 !py-1.5 text-xs font-bold text-white shadow-md shadow-green-900/30 flex items-center gap-1 active:scale-95 transition-all"
                      >
                        {markingInId === member.id ? "Marking..." : "🟢 Mark IN"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="card p-4 border border-white/10 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-white/60 mb-1">
                  Search Student, Register No, Team ID or Name
                </label>
                <input
                  className="input !py-2 text-sm"
                  placeholder="🔍 Type name, reg no, or team..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/60 mb-1">
                  Filter by Status
                </label>
                <select
                  className="input !py-2 text-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <option value="">All Statuses</option>
                  <option value="OUT">🔴 Only Outside</option>
                  <option value="IN">🟢 Only Inside</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/60 mb-1">
                  Filter by Team
                </label>
                <select
                  className="input !py-2 text-sm"
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                >
                  <option value="">All Teams ({teams?.length || 0})</option>
                  {teams?.map((t) => (
                    <option key={t.teamId} value={t.teamId}>
                      {t.teamId} - {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between text-xs text-white/50 pt-1 border-t border-white/5">
              <span>
                Showing {filteredTeams.reduce((acc, t) => acc + (t.filteredMembers?.length || 0), 0)} member(s) across {filteredTeams.length} team(s)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-orange-400 hover:underline"
                >
                  Expand All
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-white/60 hover:underline"
                >
                  Collapse All
                </button>
              </div>
            </div>
          </div>

          {/* Teams & Members List */}
          {teamsLoading ? (
            <Skeleton rows={4} />
          ) : teamsError ? (
            <ErrorBox msg={teamsError} retry={reloadTeams} />
          ) : filteredTeams.length === 0 ? (
            <Empty msg="No teams or members found matching your search." />
          ) : (
            <div className="space-y-4">
              {filteredTeams.map((t) => {
                const isExpanded = expandedTeams[t.teamId] !== false; // Default expanded
                const membersToShow = t.filteredMembers || t.members;
                const outsideInTeam = membersToShow.filter((m) => m.movementStatus === "Outside").length;

                return (
                  <div
                    key={t.teamId}
                    className="card border border-white/10 overflow-hidden bg-neutral-900/70"
                  >
                    {/* Team Header */}
                    <div
                      onClick={() => toggleTeam(t.teamId)}
                      className="flex cursor-pointer items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors border-b border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2.5 py-1 rounded-lg">
                          {t.teamId}
                        </span>
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight">{t.name}</h3>
                          <p className="text-xs text-white/50 mt-0.5">
                            {membersToShow.length} Member{membersToShow.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {outsideInTeam > 0 ? (
                          <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2.5 py-0.5 text-xs font-bold text-red-400 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
                            {outsideInTeam} Outside
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
                            All Inside
                          </span>
                        )}
                        <span className="text-white/40 text-sm">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* Member Rows */}
                    {isExpanded && (
                      <div className="divide-y divide-white/5 p-2">
                        {membersToShow.length === 0 ? (
                          <div className="p-4 text-center text-xs text-white/40">
                            No members matching filters in this team.
                          </div>
                        ) : (
                          membersToShow.map((m) => {
                            const isOut = m.movementStatus === "Outside";
                            return (
                              <div
                                key={m.id}
                                className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl transition-all ${
                                  isOut
                                    ? "bg-red-500/5 border border-red-500/20 my-1"
                                    : "hover:bg-white/[0.02]"
                                }`}
                              >
                                {/* Member Info */}
                                <div className="flex items-center gap-3 min-w-[200px] flex-1">
                                  <div
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                      isOut
                                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                        : "bg-green-500/15 text-green-400 border border-green-500/30"
                                    }`}
                                  >
                                    {isOut ? "🔴" : "👤"}
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold text-white text-sm leading-tight">
                                        {m.name}
                                      </h4>
                                      {m.role === "Leader" && (
                                        <span className="rounded bg-orange-500/20 px-1.5 py-0.2 text-[9px] font-bold text-orange-400 border border-orange-500/30">
                                          LEADER
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-white/50 mt-0.5 flex flex-wrap items-center gap-1.5">
                                      {m.email && <span>{m.email}</span>}
                                      {m.phone && (
                                        <span className="text-green-400/90 font-mono">
                                          {m.email ? "· " : ""}📞 {m.phone}
                                        </span>
                                      )}
                                      {!m.email && !m.phone && <span>No Register No / Phone</span>}
                                    </p>
                                  </div>
                                </div>

                                {/* Status & Movement Details */}
                                <div className="flex items-center gap-3">
                                  {isOut ? (
                                    <div className="text-right">
                                      <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/30 animate-pulse">
                                        🔴 Outside ({m.activeMovement?.reason || "Away"})
                                      </span>
                                      {m.activeMovement?.outTime && (
                                        <p className="text-[10px] text-white/50 font-mono mt-0.5">
                                          Out since {fmtTime(m.activeMovement.outTime)}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400 border border-green-500/25">
                                      🟢 Inside Room
                                    </span>
                                  )}

                                  {/* Direct Call Button */}
                                  {m.phone && (
                                    <a
                                      href={`tel:${m.phone.trim()}`}
                                      className="btn !bg-green-500/20 hover:!bg-green-500/30 border border-green-500/40 !px-2.5 !py-1.5 text-xs font-semibold text-green-400 active:scale-95 transition-all shadow-sm"
                                      title={`Call ${m.name} (${m.phone})`}
                                      aria-label={`Call ${m.name}`}
                                    >
                                      <span>📞</span>
                                      <span className="hidden sm:inline">Call</span>
                                    </a>
                                  )}

                                  {/* Mark IN / OUT Action Button */}
                                  {isOut ? (
                                    <button
                                      type="button"
                                      disabled={markingInId === m.id}
                                      onClick={() => handleMarkIn(m.id, m.name)}
                                      className="btn !bg-green-600 hover:!bg-green-500 !px-3.5 !py-1.5 text-xs font-bold text-white shadow-md shadow-green-900/30 flex items-center gap-1.5 active:scale-95 transition-all"
                                    >
                                      {markingInId === m.id ? "Marking..." : "🟢 Mark IN"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOutMember({
                                          member: m,
                                          teamName: t.name,
                                          teamId: t.teamId,
                                        })
                                      }
                                      className="btn !bg-neutral-800 hover:!bg-red-600 hover:border-red-500 border border-white/20 !px-3.5 !py-1.5 text-xs font-semibold text-white/90 shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                                    >
                                      <span>🔴 Mark OUT</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MOVEMENT HISTORY & LOGS */}
      {activeTab === "logs" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="card grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-6 border border-white/10">
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1">Date</label>
              <input
                type="date"
                aria-label="Filter date"
                className="input !py-1.5 text-sm"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1">Team</label>
              <input
                className="input !py-1.5 text-sm"
                placeholder="Team ID / Name"
                value={logTeam}
                onChange={(e) => setLogTeam(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1">Student</label>
              <input
                className="input !py-1.5 text-sm"
                placeholder="Student Name"
                value={logStudent}
                onChange={(e) => setLogStudent(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1">Register No</label>
              <input
                className="input !py-1.5 text-sm"
                placeholder="Register Number"
                value={logRegNo}
                onChange={(e) => setLogRegNo(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1">Status</label>
              <select
                className="input !py-1.5 text-sm"
                value={logStatus}
                onChange={(e) => setLogStatus(e.target.value)}
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
                value={logReason}
                onChange={(e) => setLogReason(e.target.value)}
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

          {/* Logs Table */}
          {logsLoading ? (
            <Skeleton rows={4} />
          ) : logsError ? (
            <ErrorBox msg={logsError} retry={reloadLogs} />
          ) : !logs || logs.length === 0 ? (
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
                  {logs.map((r) => {
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
                              disabled={markingInId === r.memberId}
                              className="btn !bg-green-600 hover:!bg-green-500 !px-3 !py-1 text-xs font-bold text-white shadow-sm flex items-center gap-1 ml-auto active:scale-95"
                              onClick={() => handleMarkIn(r.memberId, r.memberName)}
                            >
                              {markingInId === r.memberId ? "Marking IN..." : "🟢 Mark IN"}
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
      )}

      {/* Room OUT Reason Selection Modal */}
      <RoomOutModal
        member={outMember ? outMember.member : null}
        onClose={() => setOutMember(null)}
        onSuccess={() => {
          refreshAll();
        }}
      />
    </div>
  );
}
