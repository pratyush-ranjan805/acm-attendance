"use client";
import { useState } from "react";
import { Member, api } from "@/lib/api";
import { useToast } from "./ui";

const REASONS = [
  { id: "Washroom", label: "🚻 Washroom" },
  { id: "Exam", label: "📝 Exam" },
  { id: "Food", label: "🍴 Food" },
  { id: "Personal", label: "📞 Personal" },
  { id: "Other", label: "📋 Other" },
];

interface RoomOutModalProps {
  member: Member | null;
  date?: string;
  onClose: () => void;
  onSuccess: (updatedMemberId: string) => void;
}

export function RoomOutModal({
  member,
  date,
  onClose,
  onSuccess,
}: RoomOutModalProps) {
  const toast = useToast();
  const [selectedReason, setSelectedReason] = useState<string>("Washroom");
  const [customReason, setCustomReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!member) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;

    if (selectedReason === "Other" && !customReason.trim()) {
      toast("Please specify the custom reason.", false);
      return;
    }

    setLoading(true);
    try {
      await api.recordOut({
        memberId: member.id,
        reason: selectedReason,
        customReason: selectedReason === "Other" ? customReason.trim() : undefined,
        date,
      });

      toast(`${member.name} marked as Outside (🔴 ${selectedReason})`);
      onSuccess(member.id);
      onClose();
    } catch (err) {
      toast((err as Error).message || "Failed to mark student as Outside", false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="card w-full max-w-md space-y-4 border border-white/15 bg-neutral-950 p-5 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🚪</span>
              <h2 className="text-lg sm:text-xl font-bold text-white">Student is going Outside</h2>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Mark <strong className="text-white">{member.name}</strong> as 🔴 Outside
              {member.email ? ` (${member.email})` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-xl font-bold px-2 py-1 leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2 uppercase tracking-wider">
              Select Reason <span className="text-orange-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {REASONS.map((r) => {
                const isSelected = selectedReason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReason(r.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-3 text-sm font-medium transition-all select-none active:scale-95 ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/20 text-orange-400 shadow-md shadow-orange-500/10 font-bold"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedReason === "Other" && (
            <div className="animate-fadeIn">
              <label className="block text-xs font-semibold text-white/70 mb-1">
                Specify Reason <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                className="input text-sm"
                placeholder="e.g. Library, Lab Work, Medical..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            </div>
          )}

          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2.5 text-xs text-orange-300">
            ℹ️ Note: Attendance remains <strong>✅ Present</strong>. This only tracks live room movement.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn !bg-red-600 hover:!bg-red-700 text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-red-900/30"
            >
              {loading ? "Recording OUT..." : "Confirm OUT 🔴"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
