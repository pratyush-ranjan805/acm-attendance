import { v4 as uuidv4 } from "uuid";
import { getDb, initDatabase } from "../db";
import { getSupabaseClient } from "../supabase";

export interface MovementRecordDto {
  id: string;
  memberId: string;
  memberName: string;
  regNo?: string;
  role?: string;
  teamId: string;
  teamName: string;
  date: string;
  reason: string;
  customReason?: string | null;
  outTime: string;
  inTime: string | null;
  durationMinutes: number | null;
  status: "OUT" | "IN";
  createdAt: string;
}

export interface ActiveOutsideStudentDto {
  id: string;
  memberId: string;
  memberName: string;
  regNo?: string;
  teamId: string;
  teamName: string;
  reason: string;
  customReason?: string | null;
  outTime: string;
  durationSoFarMinutes: number;
}

export interface RoomStatusDto {
  date: string;
  present: number;
  inside: number;
  outside: number;
  outsideList: ActiveOutsideStudentDto[];
}

function isTableMissing(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const code = String(error.code || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("room_movements")
  );
}

// Helper to find member & team info from either Supabase or SQLite
async function findMemberAndTeam(memberId: string): Promise<{
  id: string;
  memberName: string;
  email?: string;
  role: string;
  teamDbId: string;
  teamCode: string;
  teamName: string;
} | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: member } = await supabase
        .from("team_members")
        .select("id, member_name, email, role, team_id")
        .eq("id", memberId)
        .limit(1)
        .maybeSingle();

      if (member) {
        const { data: team } = await supabase
          .from("teams")
          .select("id, team_id, team_name")
          .eq("id", member.team_id)
          .limit(1)
          .maybeSingle();

        return {
          id: String(member.id),
          memberName: String(member.member_name),
          email: member.email ? String(member.email) : undefined,
          role: String(member.role || "Member"),
          teamDbId: String(member.team_id),
          teamCode: String(team?.team_id || ""),
          teamName: String(team?.team_name || ""),
        };
      }
    } catch {}
  }

  // SQLite check
  await initDatabase();
  const db = getDb();
  const res = await db.execute({
    sql: `
      SELECT m.id, m.member_name, m.email, m.role, m.team_id as team_db_id, t.team_id as team_code, t.team_name
      FROM team_members m
      JOIN teams t ON m.team_id = t.id
      WHERE m.id = ?
      LIMIT 1
    `,
    args: [memberId],
  });

  if (res.rows.length > 0) {
    const r = res.rows[0];
    return {
      id: String(r.id),
      memberName: String(r.member_name),
      email: r.email ? String(r.email) : undefined,
      role: String(r.role || "Member"),
      teamDbId: String(r.team_db_id),
      teamCode: String(r.team_code),
      teamName: String(r.team_name),
    };
  }

  return null;
}

export async function recordStudentOut(payload: {
  memberId: string;
  reason: string;
  customReason?: string;
  date?: string;
}): Promise<MovementRecordDto> {
  const memberId = payload.memberId?.trim();
  const rawReason = payload.reason?.trim();
  const customReason = payload.customReason?.trim() || null;
  const date = payload.date?.trim() || new Date().toLocaleDateString("en-CA");
  const now = new Date().toISOString();

  if (!memberId) {
    throw new Error("Student / Member ID is required.");
  }
  if (!rawReason) {
    throw new Error("Reason is required.");
  }

  const student = await findMemberAndTeam(memberId);
  if (!student) {
    throw new Error("Student not found.");
  }

  const finalReason = rawReason === "Other" && customReason ? `Other: ${customReason}` : rawReason;
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      // Check if already active OUT
      const { data: active, error: aErr } = await supabase
        .from("room_movements")
        .select("id")
        .eq("team_member_id", memberId)
        .eq("status", "OUT")
        .is("in_time", null)
        .limit(1);

      if (aErr) {
        if (isTableMissing(aErr)) throw aErr;
      } else if (active && active.length > 0) {
        throw new Error("Student is already marked as Outside.");
      }

      const newId = uuidv4();
      const { data: inserted, error: iErr } = await supabase
        .from("room_movements")
        .insert({
          id: newId,
          team_member_id: student.id,
          team_id: student.teamDbId,
          movement_date: date,
          reason: finalReason,
          custom_reason: customReason,
          out_time: now,
          in_time: null,
          duration_minutes: null,
          status: "OUT",
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (iErr) {
        if (isTableMissing(iErr)) throw iErr;
        throw new Error(iErr.message);
      }

      return {
        id: String(inserted.id),
        memberId: student.id,
        memberName: student.memberName,
        regNo: student.email,
        role: student.role,
        teamId: student.teamCode,
        teamName: student.teamName,
        date,
        reason: finalReason,
        customReason,
        outTime: now,
        inTime: null,
        durationMinutes: null,
        status: "OUT",
        createdAt: now,
      };
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
      // Fall through to SQLite
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();

  const activeRes = await db.execute({
    sql: `SELECT id FROM room_movements WHERE team_member_id = ? AND status = 'OUT' AND in_time IS NULL LIMIT 1`,
    args: [memberId],
  });

  if (activeRes.rows.length > 0) {
    throw new Error("Student is already marked as Outside.");
  }

  const newId = uuidv4();
  await db.execute({
    sql: `
      INSERT INTO room_movements (
        id, team_member_id, team_id, student_name, reg_no, team_code, team_name,
        movement_date, reason, custom_reason, out_time, in_time, duration_minutes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'OUT', ?, ?)
    `,
    args: [
      newId,
      student.id,
      student.teamDbId,
      student.memberName,
      student.email || null,
      student.teamCode,
      student.teamName,
      date,
      finalReason,
      customReason,
      now,
      now,
      now,
    ],
  });

  return {
    id: newId,
    memberId: student.id,
    memberName: student.memberName,
    regNo: student.email,
    role: student.role,
    teamId: student.teamCode,
    teamName: student.teamName,
    date,
    reason: finalReason,
    customReason,
    outTime: now,
    inTime: null,
    durationMinutes: null,
    status: "OUT",
    createdAt: now,
  };
}

export async function recordStudentIn(payload: { memberId: string }): Promise<MovementRecordDto> {
  const memberId = payload.memberId?.trim();
  const now = new Date().toISOString();

  if (!memberId) {
    throw new Error("Student / Member ID is required.");
  }

  const student = await findMemberAndTeam(memberId);
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data: active, error: aErr } = await supabase
        .from("room_movements")
        .select("id, out_time, reason, custom_reason, movement_date, created_at")
        .eq("team_member_id", memberId)
        .eq("status", "OUT")
        .is("in_time", null)
        .order("out_time", { ascending: false })
        .limit(1);

      if (aErr) {
        if (isTableMissing(aErr)) throw aErr;
        throw new Error(aErr.message);
      }

      if (active && active.length > 0) {
        const activeRec = active[0];
        const outMs = new Date(activeRec.out_time).getTime();
        const inMs = new Date(now).getTime();
        const durationMinutes = Math.max(1, Math.round((inMs - outMs) / (1000 * 60)));

        const { error: uErr } = await supabase
          .from("room_movements")
          .update({
            in_time: now,
            duration_minutes: durationMinutes,
            status: "IN",
            updated_at: now,
          })
          .eq("id", activeRec.id);

        if (uErr) {
          if (isTableMissing(uErr)) throw uErr;
          throw new Error(uErr.message);
        }

        return {
          id: String(activeRec.id),
          memberId: student?.id || memberId,
          memberName: student?.memberName || "Student",
          regNo: student?.email,
          role: student?.role,
          teamId: student?.teamCode || "",
          teamName: student?.teamName || "",
          date: String(activeRec.movement_date),
          reason: String(activeRec.reason),
          customReason: activeRec.custom_reason ? String(activeRec.custom_reason) : null,
          outTime: String(activeRec.out_time),
          inTime: now,
          durationMinutes,
          status: "IN",
          createdAt: String(activeRec.created_at),
        };
      }
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
      // Fall through to SQLite
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();

  const activeRes = await db.execute({
    sql: `
      SELECT 
        rm.id, rm.out_time, rm.reason, rm.custom_reason, rm.movement_date, rm.created_at,
        rm.team_member_id as member_id,
        COALESCE(m.member_name, rm.student_name, 'Student') as member_name,
        COALESCE(m.email, rm.reg_no) as reg_no,
        COALESCE(m.role, 'Member') as role,
        COALESCE(t.team_id, rm.team_code, '') as team_code,
        COALESCE(t.team_name, rm.team_name, '') as team_name
      FROM room_movements rm
      LEFT JOIN team_members m ON rm.team_member_id = m.id
      LEFT JOIN teams t ON rm.team_id = t.id
      WHERE rm.team_member_id = ? AND rm.status = 'OUT' AND rm.in_time IS NULL
      ORDER BY rm.out_time DESC
      LIMIT 1
    `,
    args: [memberId],
  });

  if (activeRes.rows.length === 0) {
    throw new Error("No active Outside record found for this student.");
  }

  const row = activeRes.rows[0];
  const outMs = new Date(String(row.out_time)).getTime();
  const inMs = new Date(now).getTime();
  const durationMinutes = Math.max(1, Math.round((inMs - outMs) / (1000 * 60)));

  await db.execute({
    sql: `
      UPDATE room_movements
      SET in_time = ?, duration_minutes = ?, status = 'IN', updated_at = ?
      WHERE id = ?
    `,
    args: [now, durationMinutes, now, String(row.id)],
  });

  return {
    id: String(row.id),
    memberId: String(row.member_id),
    memberName: String(row.member_name),
    regNo: row.reg_no ? String(row.reg_no) : undefined,
    role: String(row.role),
    teamId: String(row.team_code),
    teamName: String(row.team_name),
    date: String(row.movement_date),
    reason: String(row.reason),
    customReason: row.custom_reason ? String(row.custom_reason) : null,
    outTime: String(row.out_time),
    inTime: now,
    durationMinutes,
    status: "IN",
    createdAt: String(row.created_at),
  };
}

export async function getMovements(filters: {
  date?: string;
  teamId?: string;
  student?: string;
  regNo?: string;
  status?: string;
  reason?: string;
}): Promise<MovementRecordDto[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let query = supabase
        .from("room_movements")
        .select("*")
        .order("out_time", { ascending: false });

      if (filters.date && filters.date.trim()) {
        query = query.eq("movement_date", filters.date.trim());
      }
      if (filters.status && filters.status.trim()) {
        const st = filters.status.trim().toUpperCase();
        if (st === "OUT" || st === "OUTSIDE") query = query.eq("status", "OUT");
        else if (st === "IN" || st === "INSIDE") query = query.eq("status", "IN");
      }
      if (filters.reason && filters.reason.trim()) {
        query = query.ilike("reason", `%${filters.reason.trim()}%`);
      }

      const { data, error } = await query;
      if (error) {
        if (isTableMissing(error)) throw error;
        throw new Error(error.message);
      }

      // Fetch all members & teams to join in memory
      const [membersRes, teamsRes] = await Promise.all([
        supabase.from("team_members").select("id, member_name, email, role, team_id"),
        supabase.from("teams").select("id, team_id, team_name"),
      ]);

      const memMap = new Map<string, any>();
      (membersRes.data || []).forEach((m) => memMap.set(m.id, m));

      const teamMap = new Map<string, any>();
      (teamsRes.data || []).forEach((t) => teamMap.set(t.id, t));

      let list: MovementRecordDto[] = (data || []).map((r: any) => {
        const mem = memMap.get(r.team_member_id);
        const team = teamMap.get(r.team_id) || (mem ? teamMap.get(mem.team_id) : null);
        return {
          id: String(r.id),
          memberId: String(r.team_member_id),
          memberName: String(mem?.member_name || "Unknown"),
          regNo: mem?.email ? String(mem.email) : undefined,
          role: mem?.role ? String(mem.role) : "Member",
          teamId: String(team?.team_id || ""),
          teamName: String(team?.team_name || ""),
          date: String(r.movement_date),
          reason: String(r.reason),
          customReason: r.custom_reason ? String(r.custom_reason) : null,
          outTime: String(r.out_time),
          inTime: r.in_time ? String(r.in_time) : null,
          durationMinutes: r.duration_minutes !== null && r.duration_minutes !== undefined ? Number(r.duration_minutes) : null,
          status: String(r.status) as "OUT" | "IN",
          createdAt: String(r.created_at),
        };
      });

      if (filters.teamId && filters.teamId.trim()) {
        const term = filters.teamId.trim().toLowerCase();
        list = list.filter((r) => r.teamId.toLowerCase().includes(term) || r.teamName.toLowerCase().includes(term));
      }
      if (filters.student && filters.student.trim()) {
        const term = filters.student.trim().toLowerCase();
        list = list.filter((r) => r.memberName.toLowerCase().includes(term));
      }
      if (filters.regNo && filters.regNo.trim()) {
        const term = filters.regNo.trim().toLowerCase();
        list = list.filter((r) => (r.regNo || "").toLowerCase().includes(term));
      }

      return list;
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
      // Fall through to SQLite
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();

  let sql = `
    SELECT 
      rm.id,
      rm.team_member_id as member_id,
      COALESCE(m.member_name, rm.student_name, 'Unknown') as member_name,
      COALESCE(m.email, rm.reg_no) as reg_no,
      COALESCE(m.role, 'Member') as role,
      COALESCE(t.team_id, rm.team_code, '') as team_code,
      COALESCE(t.team_name, rm.team_name, '') as team_name,
      rm.movement_date,
      rm.reason,
      rm.custom_reason,
      rm.out_time,
      rm.in_time,
      rm.duration_minutes,
      rm.status,
      rm.created_at
    FROM room_movements rm
    LEFT JOIN team_members m ON rm.team_member_id = m.id
    LEFT JOIN teams t ON rm.team_id = t.id
    WHERE 1=1
  `;
  const args: any[] = [];

  if (filters.date && filters.date.trim()) {
    sql += ` AND rm.movement_date = ?`;
    args.push(filters.date.trim());
  }
  if (filters.teamId && filters.teamId.trim()) {
    const term = `%${filters.teamId.trim().toLowerCase()}%`;
    sql += ` AND (LOWER(COALESCE(t.team_id, rm.team_code, '')) LIKE ? OR LOWER(COALESCE(t.team_name, rm.team_name, '')) LIKE ?)`;
    args.push(term, term);
  }
  if (filters.student && filters.student.trim()) {
    const term = `%${filters.student.trim().toLowerCase()}%`;
    sql += ` AND LOWER(COALESCE(m.member_name, rm.student_name, '')) LIKE ?`;
    args.push(term);
  }
  if (filters.regNo && filters.regNo.trim()) {
    const term = `%${filters.regNo.trim().toLowerCase()}%`;
    sql += ` AND LOWER(COALESCE(m.email, rm.reg_no, '')) LIKE ?`;
    args.push(term);
  }
  if (filters.status && filters.status.trim()) {
    const st = filters.status.trim().toUpperCase();
    if (st === "OUT" || st === "OUTSIDE") {
      sql += ` AND rm.status = 'OUT'`;
    } else if (st === "IN" || st === "INSIDE") {
      sql += ` AND rm.status = 'IN'`;
    }
  }
  if (filters.reason && filters.reason.trim()) {
    const term = `%${filters.reason.trim().toLowerCase()}%`;
    sql += ` AND LOWER(rm.reason) LIKE ?`;
    args.push(term);
  }

  sql += ` ORDER BY rm.out_time DESC`;

  const res = await db.execute({ sql, args });

  return res.rows.map((r) => ({
    id: String(r.id),
    memberId: String(r.member_id),
    memberName: String(r.member_name),
    regNo: r.reg_no ? String(r.reg_no) : undefined,
    role: String(r.role),
    teamId: String(r.team_code),
    teamName: String(r.team_name),
    date: String(r.movement_date),
    reason: String(r.reason),
    customReason: r.custom_reason ? String(r.custom_reason) : null,
    outTime: String(r.out_time),
    inTime: r.in_time ? String(r.in_time) : null,
    durationMinutes: r.duration_minutes !== null && r.duration_minutes !== undefined ? Number(r.duration_minutes) : null,
    status: String(r.status) as "OUT" | "IN",
    createdAt: String(r.created_at),
  }));
}

export async function getActiveMovements(date?: string): Promise<ActiveOutsideStudentDto[]> {
  const targetDate = date || new Date().toLocaleDateString("en-CA");
  const nowMs = Date.now();

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("room_movements")
        .select("*")
        .eq("status", "OUT")
        .is("in_time", null)
        .eq("movement_date", targetDate)
        .order("out_time", { ascending: false });

      if (error) {
        if (isTableMissing(error)) throw error;
        throw new Error(error.message);
      }

      const [membersRes, teamsRes] = await Promise.all([
        supabase.from("team_members").select("id, member_name, email, team_id"),
        supabase.from("teams").select("id, team_id, team_name"),
      ]);

      const memMap = new Map<string, any>();
      (membersRes.data || []).forEach((m) => memMap.set(m.id, m));

      const teamMap = new Map<string, any>();
      (teamsRes.data || []).forEach((t) => teamMap.set(t.id, t));

      return (data || []).map((r: any) => {
        const mem = memMap.get(r.team_member_id);
        const team = teamMap.get(r.team_id) || (mem ? teamMap.get(mem.team_id) : null);
        const outMs = new Date(r.out_time).getTime();
        const dur = Math.max(1, Math.round((nowMs - outMs) / (1000 * 60)));
        return {
          id: String(r.id),
          memberId: String(r.team_member_id),
          memberName: String(mem?.member_name || "Unknown"),
          regNo: mem?.email ? String(mem.email) : undefined,
          teamId: String(team?.team_id || ""),
          teamName: String(team?.team_name || ""),
          reason: String(r.reason),
          customReason: r.custom_reason ? String(r.custom_reason) : null,
          outTime: String(r.out_time),
          durationSoFarMinutes: dur,
        };
      });
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
      // Fall through to SQLite
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();

  const res = await db.execute({
    sql: `
      SELECT 
        rm.id,
        rm.team_member_id as member_id,
        COALESCE(m.member_name, rm.student_name, 'Unknown') as member_name,
        COALESCE(m.email, rm.reg_no) as reg_no,
        COALESCE(t.team_id, rm.team_code, '') as team_code,
        COALESCE(t.team_name, rm.team_name, '') as team_name,
        rm.reason,
        rm.custom_reason,
        rm.out_time
      FROM room_movements rm
      LEFT JOIN team_members m ON rm.team_member_id = m.id
      LEFT JOIN teams t ON rm.team_id = t.id
      WHERE rm.status = 'OUT' AND rm.in_time IS NULL AND rm.movement_date = ?
      ORDER BY rm.out_time DESC
    `,
    args: [targetDate],
  });

  return res.rows.map((r) => {
    const outMs = new Date(String(r.out_time)).getTime();
    const dur = Math.max(1, Math.round((nowMs - outMs) / (1000 * 60)));
    return {
      id: String(r.id),
      memberId: String(r.member_id),
      memberName: String(r.member_name),
      regNo: r.reg_no ? String(r.reg_no) : undefined,
      teamId: String(r.team_code),
      teamName: String(r.team_name),
      reason: String(r.reason),
      customReason: r.custom_reason ? String(r.custom_reason) : null,
      outTime: String(r.out_time),
      durationSoFarMinutes: dur,
    };
  });
}

export async function getRoomStatusSummary(targetDate?: string): Promise<RoomStatusDto> {
  const date = targetDate || new Date().toLocaleDateString("en-CA");
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const [attRes, outsideList] = await Promise.all([
        supabase.from("attendance").select("team_member_id").eq("attendance_date", date).eq("status", "Present"),
        getActiveMovements(date),
      ]);

      const present = (attRes.data || []).length;
      const outside = outsideList.length;
      const inside = Math.max(0, present - outside);

      return {
        date,
        present,
        inside,
        outside,
        outsideList,
      };
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
      // Fall through to SQLite
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();

  const [attRes, outsideList] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) as count FROM attendance WHERE attendance_date = ? AND status = 'Present'`,
      args: [date],
    }),
    getActiveMovements(date),
  ]);

  const present = Number(attRes.rows[0]?.count ?? 0);
  const outside = outsideList.length;
  const inside = Math.max(0, present - outside);

  return {
    date,
    present,
    inside,
    outside,
    outsideList,
  };
}
