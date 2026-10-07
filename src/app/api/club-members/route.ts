import { NextRequest, NextResponse } from "next/server";
import { getClubMembers, addClubMember } from "@/server/services/clubService";
import { authenticateRequest } from "@/server/auth";

export async function GET(req: NextRequest) {
  try {
    const admin = await authenticateRequest(req);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized. Admin access only." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;

    const members = await getClubMembers({ date, search, role });
    return NextResponse.json(members, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Failed to fetch club members." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await authenticateRequest(req);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized. Admin access only." }, { status: 401 });
    }

    const body = await req.json();
    const created = await addClubMember(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Failed to add club member." },
      { status: 400 }
    );
  }
}
