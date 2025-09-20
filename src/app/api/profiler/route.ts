import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Types
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
  name: string;
  createdAt: string;
  data: ProfilerExportedData;
};

// Define the storage directory - we'll use a directory inside the project
const PROFILER_STORAGE_DIR = path.join(process.cwd(), "profiler-data");

// Ensure the storage directory exists
async function ensureDirectoryExists() {
  try {
    await fs.access(PROFILER_STORAGE_DIR);
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(PROFILER_STORAGE_DIR, { recursive: true });
    console.log(`Created profiler data directory: ${PROFILER_STORAGE_DIR}`);
  }
}

// Helper function to save session to a file
async function saveSessionToFile(
  sessionId: string,
  session: SavedProfilerSession,
): Promise<void> {
  await ensureDirectoryExists();
  const filePath = path.join(PROFILER_STORAGE_DIR, `${sessionId}.json`);
  await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf8");
}

// Helper function to read session from a file
async function readSessionFromFile(
  sessionId: string,
): Promise<SavedProfilerSession | null> {
  try {
    const filePath = path.join(PROFILER_STORAGE_DIR, `${sessionId}.json`);
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data) as SavedProfilerSession;
  } catch (error) {
    console.error(`Failed to read session ${sessionId}:`, error);
    return null;
  }
}

// Helper function to list all sessions with more details
async function listAllSessions(): Promise<
  { id: string; name: string; createdAt: string }[]
> {
  await ensureDirectoryExists();

  try {
    const files = await fs.readdir(PROFILER_STORAGE_DIR);
    const sessions = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          try {
            const filePath = path.join(PROFILER_STORAGE_DIR, file);
            const content = await fs.readFile(filePath, "utf8");
            const session = JSON.parse(content) as SavedProfilerSession;
            return {
              id: session.id,
              name: session.name,
              createdAt: session.createdAt,
            };
          } catch (error) {
            console.error(`Error reading session file ${file}:`, error);
            return null;
          }
        }),
    );

    // Filter out any nulls from failed reads
    return sessions.filter((session) => session !== null) as {
      id: string;
      name: string;
      createdAt: string;
    }[];
  } catch (error) {
    console.error("Failed to list profiler sessions:", error);
    return [];
  }
}

// Helper function to find a session by name
async function findSessionByName(
  name: string,
): Promise<SavedProfilerSession | null> {
  const sessions = await listAllSessions();
  const sessionWithName = sessions.find((session) => session.name === name);

  if (!sessionWithName) {
    return null;
  }

  return readSessionFromFile(sessionWithName.id);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.data) {
      return NextResponse.json(
        { error: "Missing required fields: name and data" },
        { status: 400 },
      );
    }

    const { name, data } = body;

    // Validate that data has the correct structure
    if (!data.commits || !Array.isArray(data.commits)) {
      return NextResponse.json(
        { error: "Invalid profiler data format" },
        { status: 400 },
      );
    }

    const sessionId = `profile_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const session: SavedProfilerSession = {
      id: sessionId,
      name,
      createdAt: new Date().toISOString(),
      data,
    };

    // Save to file instead of memory
    await saveSessionToFile(sessionId, session);

    return NextResponse.json({
      success: true,
      sessionId,
      message: `Profiler session saved successfully to file`,
    });
  } catch (error) {
    console.error("Error saving profiler data:", error);
    return NextResponse.json(
      { error: "Failed to save profiler data" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  await ensureDirectoryExists();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name");

    // If name is provided, find session by name
    if (name) {
      const session = await findSessionByName(name);
      if (!session) {
        return NextResponse.json(
          { error: `Profiler session with name '${name}' not found` },
          { status: 404 },
        );
      }
      return NextResponse.json(session);
    }

    // If ID is provided, return specific session
    if (id) {
      const session = await readSessionFromFile(id);
      if (!session) {
        return NextResponse.json(
          { error: "Profiler session not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(session);
    }

    // Otherwise return list of all sessions with names included
    const sessions = await listAllSessions();

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error retrieving profiler data:", error);
    return NextResponse.json(
      { error: "Failed to retrieve profiler data" },
      { status: 500 },
    );
  }
}

// Add DELETE endpoint to remove session files
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    const filePath = path.join(PROFILER_STORAGE_DIR, `${id}.json`);

    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await fs.unlink(filePath);

    return NextResponse.json({
      success: true,
      message: `Session ${id} deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting profiler session:", error);
    return NextResponse.json(
      { error: "Failed to delete profiler session" },
      { status: 500 },
    );
  }
}
