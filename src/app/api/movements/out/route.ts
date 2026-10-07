import { NextRequest, NextResponse } from "next/server";
import { recordStudentOut } from "@/server/services/movementService";
import { authenticateRequest } from "@/server/auth";

export async function POST(req: NextRequest) {
  try {
    const admin = await authenticateRequest(req);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized. Admin access only." }, { status: 401 });
    }

    const body = await req.json();
    const result = await recordStudentOut(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Failed to record student movement out." },
      { status: 400 }
    );
  }
}
