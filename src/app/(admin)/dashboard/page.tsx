"use client";
import Link from "next/link";
import { useState } from "react";
import { api, today, fmtDate, fmtTime } from "@/lib/api";
import { ErrorBox, Skeleton, Stat, useLoad, useToast } from "@/components/ui";
import { TeamSearch } from "@/components/Team";
import { ExportButton } from "@/components/Shell";
import { ImportModal } from "@/components/ImportModal";
import { RegisterTeamModal } from "@/components/RegisterTeamModal";

export default function Dashboard() {
  const d = today();
  const toast = useToast();
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showOutsideList, setShowOutsideList] = useState(false);
  const [k, setK] = useState(0);

  const { data, error, loading, reload } = useLoad(() => api.stats(d), [d, k]);
  const {
    data: roomStatus,
    loading: roomLoading,
    reload: reloadRoom,
  } = useLoad(() => api.roomStatus(d), [d, k]);

  function reloadAll() {
    reload();
    reloadRoom();
    setK((prev) => prev + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ACM SIGGRAPH Hackathon Attendance</h1>
          <p className="text-white/60">
            Manage team attendance and event participation · {fmtDate(d)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setManualOpen(true)}
            className="btn !bg-neutral-800 hover:!bg-neutral-700 border border-white/10 flex items-center gap-1.5 text-sm"
          >
            ✏️ Register Team
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="btn !bg-orange-600 hover:!bg-orange-700 flex items-center gap-1.5 text-sm"
          >
            📤 Upload Excel / PDF
          </button>
          <ExportButton date={d} label="Export Attendance" />
        </div>
      </div>

      {loading ? (
        <Skeleton rows={1} />
      ) : error ? (
        <ErrorBox msg={error} retry={reloadAll} />
      ) : (
        data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Total Teams" value={data.totalTeams} />
            <Stat label="Total Members" value={data.totalMembers} />
            <Stat label="Present Today" value={data.present} />
            <Stat label="Absent Today" value={data.absent} />
            <Stat
              label="Attendance"
              value={`${data.percentage.toFixed(2)}%`}
            />
          </div>
        )
      )}

      {/* Room Status Live Section */}
      {roomStatus && (
        <div className="card p-5 border border-white/10 space-y-4 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>🚪</span> Room Status
              </h2>
              <p className="text-xs text-white/50">
                Live in-out room occupancy for present students
              </p>
            </div>
            <Link
              href="/movements"
              className="text-xs text-orange-400 hover:underline flex items-center gap-1"
            >
              Movement History →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 text-center">
              <p className="text-xs text-white/60 font-medium">👥 Present</p>
              <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {roomStatus.present}
              </p>
            </div>

            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3.5 text-center">
              <p className="text-xs text-green-400 font-medium">🟢 Inside</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-400 mt-1">
                {roomStatus.inside}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowOutsideList((prev) => !prev)}
              className={`rounded-xl border p-3.5 text-center transition-all cursor-pointer select-none ${
                roomStatus.outside > 0
                  ? "border-red-500/50 bg-red-500/15 hover:bg-red-500/25 active:scale-95 shadow-lg shadow-red-950/30"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <p className="text-xs text-red-300 font-medium flex items-center justify-center gap-1">
                <span>🔴 Outside</span>
                {roomStatus.outside > 0 && (
                  <span className="text-[10px] bg-red-500/30 px-1.5 py-0.2 rounded font-mono">
                    {showOutsideList ? "hide" : "view"}
                  </span>
                )}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-red-400 mt-1">
                {roomStatus.outside}
              </p>
            </button>
          </div>

          {/* Currently Outside List Drawer */}
          {showOutsideList && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
                <h3 className="text-xs sm:text-sm font-bold text-red-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                  Currently Outside ({roomStatus.outsideList.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowOutsideList(false)}
                  className="text-xs text-white/50 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              {roomStatus.outsideList.length === 0 ? (
                <p className="text-xs text-white/50 py-3 text-center">
                  All present students are currently inside the room.
                </p>
              ) : (
                <div className="divide-y divide-white/5">
                  {roomStatus.outsideList.map((st) => (
                    <div
                      key={st.id}
                      className="py-2.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="text-sm">
                        <span className="font-semibold text-white">{st.memberName}</span>
                        <span className="text-white/40"> — </span>
                        <span className="font-mono text-orange-400 text-xs font-semibold">
                          Team {st.teamId}
                        </span>
                        <span className="text-white/40"> — </span>
                        <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/90">
                          {st.reason}
                        </span>
                        <span className="text-white/40"> — </span>
                        <span className="font-mono text-xs text-white/60">
                          {fmtTime(st.outTime)} ({st.durationSoFarMinutes}m ago)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.recordIn(st.memberId);
                            toast(`${st.memberName} marked as Inside`);
                            reloadAll();
                          } catch (e) {
                            toast((e as Error).message, false);
                          }
                        }}
                        className="btn !bg-green-600 hover:!bg-green-500 !px-3 !py-1 text-xs font-bold text-white shadow-sm flex items-center gap-1 active:scale-95"
                      >
                        🟢 Mark IN
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <TeamSearch key={k} />

      <RegisterTeamModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSuccess={() => {
          reload();
          setK((prev) => prev + 1);
        }}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          reload();
          setK((prev) => prev + 1);
        }}
      />
    </div>
  );
}
