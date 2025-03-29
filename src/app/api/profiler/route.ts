import { NextRequest, NextResponse } from "next/server";

// In-memory storage for profiler data
type ProfilerPhase = string;
type ProfilerData = {
  id: string;
  phase: ProfilerPhase;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  formattedCommitTime: string;
};

type ProfilerExportedData = {
  commits: {
    id: string;
    profiles: ProfilerData[];
  }[];
};

type SavedProfilerSession = {
  id: string;
  createdAt: string;
  data: ProfilerExportedData;
};

// In-memory storage for profiler sessions
const profilerSessions = new Map<string, SavedProfilerSession>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.data) {
      return NextResponse.json(
        { error: "Missing required fields: name and data" },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validate that data has the correct structure
    if (!data.commits || !Array.isArray(data.commits)) {
      return NextResponse.json(
        { error: "Invalid profiler data format" },
        { status: 400 }
      );
    }

    const sessionId = `profile_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const session: SavedProfilerSession = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      data,
    };

    profilerSessions.set(sessionId, session);

    return NextResponse.json({
      success: true,
      sessionId,
      message: `Profiler session '${name}' saved successfully`,
    });
  } catch (error) {
    console.error("Error saving profiler data:", error);
    return NextResponse.json(
      { error: "Failed to save profiler data" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // If ID is provided, return specific session
    if (id) {
      const session = profilerSessions.get(id);
      if (!session) {
        return NextResponse.json(
          { error: "Profiler session not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(session);
    }

    // Otherwise return list of all sessions (without the full data to keep response size reasonable)
    const sessions = Array.from(profilerSessions.values()).map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error retrieving profiler data:", error);
    return NextResponse.json(
      { error: "Failed to retrieve profiler data" },
      { status: 500 }
    );
  }
}
