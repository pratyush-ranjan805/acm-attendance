-- ============================================================
-- ACM SIGGRAPH Attendance Management System
-- Supabase Database Setup Script
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TEAM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Leader', 'Member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If you have an existing database, run this to add the phone column:
-- ALTER TABLE team_members ADD COLUMN IF NOT EXISTS phone TEXT;

-- 4. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by TEXT,
  UNIQUE (team_member_id, attendance_date)
);

-- 5. ROOM MOVEMENTS TABLE (In-Out Tracking)
CREATE TABLE IF NOT EXISTS room_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  movement_date DATE NOT NULL,
  reason TEXT NOT NULL,
  custom_reason TEXT,
  out_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  in_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT NOT NULL CHECK (status IN ('OUT', 'IN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CLUB MEMBERS TABLE
CREATE TABLE IF NOT EXISTS club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  register_no TEXT,
  role TEXT NOT NULL DEFAULT 'Member',
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. CLUB ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS club_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by TEXT,
  UNIQUE (club_member_id, attendance_date)
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(team_member_id);
CREATE INDEX IF NOT EXISTS idx_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_team_id ON teams(team_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON room_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_movements_member ON room_movements(team_member_id);
CREATE INDEX IF NOT EXISTS idx_movements_status ON room_movements(status);
CREATE INDEX IF NOT EXISTS idx_club_att_date ON club_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_club_att_member ON club_attendance(club_member_id);

-- ============================================================
-- DISABLE ROW LEVEL SECURITY (Admin-only system)
-- ============================================================
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE room_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_attendance DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DEFAULT ADMIN
-- Password: Admin@123  (bcrypt hash below)
-- ============================================================
INSERT INTO admins (name, email, password_hash, role)
VALUES (
  'SIGGRAPH Admin',
  'admin@siggraph.acm.org',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- Admin@123 (bcrypt)
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- DONE! Your Supabase database is ready.
-- ============================================================
-- Login credentials:
--   Email:    admin@siggraph.acm.org
--   Password: Admin@123
-- ============================================================
