import { NextRequest, NextResponse } from "next/server";
import { saveClubAttendanceBatch } from "@/server/services/clubService";
import { authenticateRequest } from "@/server/auth";

export async function POST(req: NextRequest) {
  try {
    const admin = await authenticateRequest(req);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized. Admin access only." }, { status: 401 });
    }

    const payload = await req.json();
    const result = await saveClubAttendanceBatch(payload, (admin as any).id || "admin");
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Failed to save club attendance." },
      { status: 400 }
    );
  }
}
