import { createClient, Client } from "@libsql/client";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

let dbInstance: Client | null = null;
let initialized = false;

export function getDb(): Client {
  if (!dbInstance) {
    const dbUrl = process.env.DATABASE_URL || "file:./data/attendance.db";
    
    // Ensure directory exists if it's a local file database
    if (dbUrl.startsWith("file:")) {
      const dbPath = dbUrl.replace("file:", "");
      const resolvedDir = path.dirname(path.resolve(process.cwd(), dbPath));
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }
    }

    dbInstance = createClient({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  return dbInstance;
}

export async function initDatabase(): Promise<void> {
  if (initialized) return;
  const db = getDb();

  // Create tables according to requirements
  await db.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      team_id TEXT UNIQUE NOT NULL,
      team_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      member_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'Member',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migrate phone column if not exists
  try {
    await db.execute(`ALTER TABLE team_members ADD COLUMN phone TEXT;`);
  } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      team_member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
      marked_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      marked_by TEXT,
      UNIQUE (team_member_id, attendance_date)
    );
  `);

  // Ensure room_movements has all needed columns without foreign key locks
  try {
    const tableInfo = await db.execute(`PRAGMA table_info(room_movements);`);
    const cols = tableInfo.rows.map((r: any) => String(r.name));
    if (cols.length > 0 && !cols.includes("student_name")) {
      await db.execute(`DROP TABLE IF EXISTS room_movements;`);
    }
  } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS room_movements (
      id TEXT PRIMARY KEY,
      team_member_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      student_name TEXT,
      reg_no TEXT,
      team_code TEXT,
      team_name TEXT,
      movement_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      custom_reason TEXT,
      out_time TEXT NOT NULL,
      in_time TEXT,
      duration_minutes INTEGER,
      status TEXT NOT NULL CHECK (status IN ('OUT', 'IN')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS club_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      register_no TEXT,
      role TEXT NOT NULL DEFAULT 'Member',
      department TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS club_attendance (
      id TEXT PRIMARY KEY,
      club_member_id TEXT NOT NULL,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
      marked_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      marked_by TEXT,
      UNIQUE (club_member_id, attendance_date)
    );
  `);

  // Create indexes for performance
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(team_member_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_members_team ON team_members(team_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_teams_team_id ON teams(team_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_movements_date ON room_movements(movement_date);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_movements_member ON room_movements(team_member_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_movements_status ON room_movements(status);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_club_att_date ON club_attendance(attendance_date);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_club_att_member ON club_attendance(club_member_id);`);

  // Seed default Admin if no admin exists
  const adminRes = await db.execute(`SELECT COUNT(*) as count FROM admins;`);
  const adminCount = Number(adminRes.rows[0]?.count ?? 0);

  if (adminCount === 0) {
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@siggraph.acm.org";
    const adminPass = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123";
    const passHash = await bcrypt.hash(adminPass, 10);
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO admins (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [uuidv4(), "SIGGRAPH Admin", adminEmail.toLowerCase(), passHash, "admin", now, now],
    });
  }

  initialized = true;
}
