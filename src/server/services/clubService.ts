import { v4 as uuidv4 } from "uuid";
import { getDb, initDatabase } from "../db";
import { getSupabaseClient } from "../supabase";

export interface ClubMemberDto {
  id: string;
  name: string;
  registerNo?: string;
  role: string;
  department?: string;
  status: "Present" | "Absent" | null;
  markedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
    msg.includes("club_members") ||
    msg.includes("club_attendance")
  );
}

export async function getClubMembers(filters: {
  date?: string;
  search?: string;
  role?: string;
}): Promise<ClubMemberDto[]> {
  const targetDate = filters.date || new Date().toLocaleDateString("en-CA");
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      let query = supabase.from("club_members").select("*").order("name", { ascending: true });

      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim();
        query = query.or(`name.ilike.%${term}%,register_no.ilike.%${term}%,department.ilike.%${term}%`);
      }
      if (filters.role && filters.role.trim()) {
        query = query.eq("role", filters.role.trim());
      }

      const { data: members, error: mErr } = await query;
      if (mErr) {
        if (isTableMissing(mErr)) throw mErr;
        throw new Error(mErr.message);
      }

      const memberIds = (members || []).map((m: any) => m.id);
      let attMap = new Map<string, { status: "Present" | "Absent"; marked_at: string | null }>();

      if (memberIds.length > 0) {
        try {
          const { data: attData } = await supabase
            .from("club_attendance")
            .select("club_member_id, status, marked_at")
            .eq("attendance_date", targetDate)
            .in("club_member_id", memberIds);

          (attData || []).forEach((a: any) => {
            attMap.set(a.club_member_id, { status: a.status, marked_at: a.marked_at });
          });
        } catch {}
      }

      return (members || []).map((m: any) => {
        const att = attMap.get(m.id);
        return {
          id: String(m.id),
          name: String(m.name),
          registerNo: m.register_no ? String(m.register_no) : undefined,
          role: String(m.role || "Member"),
          department: m.department ? String(m.department) : undefined,
          status: att ? att.status : null,
          markedAt: att ? att.marked_at : null,
          createdAt: String(m.created_at),
          updatedAt: String(m.updated_at),
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

  let sql = `
    SELECT 
      cm.id,
      cm.name,
      cm.register_no,
      cm.role,
      cm.department,
      cm.created_at,
      cm.updated_at,
      ca.status as attendance_status,
      ca.marked_at
    FROM club_members cm
    LEFT JOIN club_attendance ca ON cm.id = ca.club_member_id AND ca.attendance_date = ?
    WHERE 1=1
  `;
  const args: any[] = [targetDate];

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    sql += ` AND (LOWER(cm.name) LIKE ? OR LOWER(cm.register_no) LIKE ? OR LOWER(cm.department) LIKE ?)`;
    args.push(term, term, term);
  }
  if (filters.role && filters.role.trim()) {
    sql += ` AND cm.role = ?`;
    args.push(filters.role.trim());
  }

  sql += ` ORDER BY CASE WHEN cm.role = 'Lead' THEN 0 WHEN cm.role = 'Core' THEN 1 ELSE 2 END, cm.name ASC`;

  const res = await db.execute({ sql, args });

  return res.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    registerNo: r.register_no ? String(r.register_no) : undefined,
    role: String(r.role || "Member"),
    department: r.department ? String(r.department) : undefined,
    status: (r.attendance_status ? String(r.attendance_status) : null) as "Present" | "Absent" | null,
    markedAt: r.marked_at ? String(r.marked_at) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function addClubMember(data: {
  name: string;
  registerNo?: string;
  role?: string;
  department?: string;
}): Promise<ClubMemberDto> {
  const name = data.name?.trim();
  const registerNo = data.registerNo?.trim() || null;
  const role = data.role?.trim() || "Member";
  const department = data.department?.trim() || null;
  const now = new Date().toISOString();

  if (!name) {
    throw new Error("Member name is required.");
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const newId = uuidv4();
      const { data: inserted, error } = await supabase
        .from("club_members")
        .insert({
          id: newId,
          name,
          register_no: registerNo,
          role,
          department,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        if (isTableMissing(error)) throw error;
        throw new Error(error.message);
      }

      return {
        id: String(inserted.id),
        name: String(inserted.name),
        registerNo: inserted.register_no ? String(inserted.register_no) : undefined,
        role: String(inserted.role || "Member"),
        department: inserted.department ? String(inserted.department) : undefined,
        status: null,
        markedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
      // Fall through to SQLite
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();

  const id = uuidv4();
  await db.execute({
    sql: `INSERT INTO club_members (id, name, register_no, role, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, name, registerNo, role, department, now, now],
  });

  return {
    id,
    name,
    registerNo: registerNo || undefined,
    role,
    department: department || undefined,
    status: null,
    markedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateClubMember(
  id: string,
  data: {
    name?: string;
    registerNo?: string;
    role?: string;
    department?: string;
  }
): Promise<ClubMemberDto> {
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const updateObj: Record<string, any> = { updated_at: now };
      if (data.name !== undefined) updateObj.name = data.name.trim();
      if (data.registerNo !== undefined) updateObj.register_no = data.registerNo ? data.registerNo.trim() : null;
      if (data.role !== undefined) updateObj.role = data.role.trim();
      if (data.department !== undefined) updateObj.department = data.department ? data.department.trim() : null;

      const { data: updated, error } = await supabase
        .from("club_members")
        .update(updateObj)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (isTableMissing(error)) throw error;
        throw new Error(error.message);
      }

      return {
        id: String(updated.id),
        name: String(updated.name),
        registerNo: updated.register_no ? String(updated.register_no) : undefined,
        role: String(updated.role),
        department: updated.department ? String(updated.department) : undefined,
        status: null,
        markedAt: null,
        createdAt: String(updated.created_at),
        updatedAt: now,
      };
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
      // Fall through to SQLite
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();

  const existingRes = await db.execute({
    sql: `SELECT id, name, register_no, role, department, created_at FROM club_members WHERE id = ? LIMIT 1`,
    args: [id],
  });

  if (existingRes.rows.length === 0) {
    throw new Error("Club member not found.");
  }

  const existing = existingRes.rows[0];
  const newName = data.name !== undefined ? data.name.trim() : String(existing.name);
  const newReg = data.registerNo !== undefined ? (data.registerNo ? data.registerNo.trim() : null) : (existing.register_no ? String(existing.register_no) : null);
  const newRole = data.role !== undefined ? data.role.trim() : String(existing.role);
  const newDept = data.department !== undefined ? (data.department ? data.department.trim() : null) : (existing.department ? String(existing.department) : null);

  await db.execute({
    sql: `UPDATE club_members SET name = ?, register_no = ?, role = ?, department = ?, updated_at = ? WHERE id = ?`,
    args: [newName, newReg, newRole, newDept, now, id],
  });

  return {
    id,
    name: newName,
    registerNo: newReg || undefined,
    role: newRole,
    department: newDept || undefined,
    status: null,
    markedAt: null,
    createdAt: String(existing.created_at),
    updatedAt: now,
  };
}

export async function deleteClubMember(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("club_attendance").delete().eq("club_member_id", id);
      const { error } = await supabase.from("club_members").delete().eq("id", id);
      if (error && !isTableMissing(error)) throw new Error(error.message);
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();
  await db.execute({ sql: `DELETE FROM club_attendance WHERE club_member_id = ?`, args: [id] });
  await db.execute({ sql: `DELETE FROM club_members WHERE id = ?`, args: [id] });
}

export async function saveClubAttendanceBatch(
  payload: {
    date?: string;
    records?: { memberId: string; status: "Present" | "Absent" }[];
  },
  adminUserId?: string
): Promise<{ markedAt: string; count: number }> {
  const now = new Date().toISOString();
  const date = payload.date || new Date().toLocaleDateString("en-CA");
  const markedBy = adminUserId || "admin";
  const records = payload.records || [];

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("No attendance records provided.");
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let count = 0;
      for (const item of records) {
        if (!item.memberId) continue;
        const status = item.status === "Present" ? "Present" : "Absent";

        const { error } = await supabase.from("club_attendance").upsert(
          {
            club_member_id: item.memberId,
            attendance_date: date,
            status,
            marked_at: now,
            updated_at: now,
            marked_by: markedBy,
          },
          { onConflict: "club_member_id,attendance_date" }
        );

        if (error) {
          if (isTableMissing(error)) throw error;
          throw new Error(error.message);
        }
        count++;
      }
      return { markedAt: now, count };
    } catch (err: any) {
      if (!isTableMissing(err)) throw err;
      // Fall through to SQLite
    }
  }

  // SQLite Fallback
  await initDatabase();
  const db = getDb();

  let count = 0;
  for (const item of records) {
    if (!item.memberId) continue;
    const status = item.status === "Present" ? "Present" : "Absent";
    const attId = uuidv4();

    await db.execute({
      sql: `
        INSERT INTO club_attendance (id, club_member_id, attendance_date, status, marked_at, updated_at, marked_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(club_member_id, attendance_date) DO UPDATE SET
          status = excluded.status,
          marked_at = excluded.marked_at,
          updated_at = excluded.updated_at,
          marked_by = excluded.marked_by;
      `,
      args: [attId, item.memberId, date, status, now, now, markedBy],
    });
    count++;
  }

  return { markedAt: now, count };
}
