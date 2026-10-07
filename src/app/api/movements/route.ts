import { NextRequest, NextResponse } from "next/server";
import { getMovements } from "@/server/services/movementService";
import { authenticateRequest } from "@/server/auth";

export async function GET(req: NextRequest) {
  try {
    const admin = await authenticateRequest(req);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized. Admin access only." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const teamId = searchParams.get("teamId") || searchParams.get("team") || undefined;
    const student = searchParams.get("student") || undefined;
    const regNo = searchParams.get("regNo") || searchParams.get("registerNumber") || undefined;
    const status = searchParams.get("status") || undefined;
    const reason = searchParams.get("reason") || undefined;

    const records = await getMovements({
      date,
      teamId,
      student,
      regNo,
      status,
      reason,
    });

    return NextResponse.json(records, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Failed to fetch movement history." },
      { status: 500 }
    );
  }
}
