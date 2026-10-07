import { NextRequest, NextResponse } from "next/server";
import { recordStudentIn } from "@/server/services/movementService";
import { authenticateRequest } from "@/server/auth";

export async function POST(req: NextRequest) {
  try {
    const admin = await authenticateRequest(req);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized. Admin access only." }, { status: 401 });
    }

    const body = await req.json();
    const result = await recordStudentIn(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Failed to record student return in." },
      { status: 400 }
    );
  }
}
