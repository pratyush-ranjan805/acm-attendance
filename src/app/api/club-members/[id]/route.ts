import { NextRequest, NextResponse } from "next/server";
import { updateClubMember, deleteClubMember } from "@/server/services/clubService";
import { authenticateRequest } from "@/server/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await authenticateRequest(req);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized. Admin access only." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const updated = await updateClubMember(id, body);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Failed to update club member." },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await authenticateRequest(req);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized. Admin access only." }, { status: 401 });
    }

    const { id } = await params;
    await deleteClubMember(id);
    return NextResponse.json({ message: "Club member deleted." }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Failed to delete club member." },
      { status: 500 }
    );
  }
}
