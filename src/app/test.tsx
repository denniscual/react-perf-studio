"use client";
import React from "react";

export default function TestList() {
  const [text, setText] = React.useState("");
  const deferredText = React.useDeferredValue(text);

  return (
    <div className="space-y-4 p-4">
      {/* Horizontal Layout */}
      <div className="flex flex-row space-x-6">
        {/* Left Pane - List Component */}
        <div className="w-3/10 border border-gray-200 rounded-md p-4">
          <h2 className="text-lg font-bold mb-4">Input and List</h2>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Type to trigger re-rendering..."
          />
          <WrapperProfiler id="List">
            <List text={deferredText} />
          </WrapperProfiler>
        </div>
        {/* Right Pane - Profiler View */}
        <div className="w-7/10 border border-gray-200 rounded-md p-4">
          <h2 className="text-lg font-bold mb-4">Profiler Data</h2>
          <div className="space-y-3">
            <ProfilerControls profilerDataStore={profilerDataStore} />
            <ProfilerView profilerDataStore={profilerDataStore} />
          </div>
        </div>
      </div>
    </div>
  );
}

// New component for profiler controls
const ProfilerControls = React.memo(function ProfilerControls({
  profilerDataStore,
}: {
  profilerDataStore: ProfilerDataStore;
}) {
  const [isProfilingStarted, setIsProfilingStarted] = React.useState(false);

  const handleToggleProfiling = React.useCallback(() => {
    const newState = !isProfilingStarted;
    setIsProfilingStarted(newState);
    if (newState) {
      profilerDataStore.startProfiling();
    } else {
      profilerDataStore.stopProfiling();
    }
  }, [isProfilingStarted, profilerDataStore]);

  return (
    <button
      onClick={handleToggleProfiling}
      className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-colors ${
        isProfilingStarted
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-green-600 text-white hover:bg-green-700"
      }`}
    >
      {isProfilingStarted ? "Stop Profiling" : "Start Profiling"}
    </button>
  );
});

function ProfilerView({
  profilerDataStore,
}: {
  profilerDataStore: ProfilerDataStore;
}) {
  // Use useState and useEffect to retrieve the profiler data
  const [profilerData, setProfilerData] = React.useState<Map<string, any[]>>(
    new Map()
  );

  React.useEffect(() => {
    // Update the profiler data every 500ms
    const intervalId = setInterval(() => {
      setProfilerData(new Map(profilerDataStore.records));
    }, 500);

    return () => clearInterval(intervalId);
  }, [profilerDataStore]);

  if (profilerData.size === 0) {
    return (
      <div className="text-gray-500 italic">
        No profiling data available yet. Start profiling and interact with the
        list to see data.
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[600px]">
      {Array.from(profilerData.entries()).map(([commitTime, profiles]) => (
        <div key={commitTime} className="mb-4 border-b pb-2">
          <h3 className="font-medium">Commit at: {commitTime}</h3>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Component</th>
                <th className="text-left py-2">Phase</th>
                <th className="text-left py-2">Actual Duration</th>
                <th className="text-left py-2">Base Duration</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile, idx) => (
                <tr key={`${profile.id}-${idx}`}>
                  <td className="py-1">{profile.id}</td>
                  <td className="py-1">{profile.phase}</td>
                  <td className="py-1">
                    {formatMilliseconds(profile.actualDuration)}
                  </td>
                  <td className="py-1">
                    {formatMilliseconds(profile.baseDuration)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

const List = React.memo(function List({ text }: { text: string }) {
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    items.push(
      <WrapperProfiler id="SlowItem" key={i}>
        <SlowItem text={text} />
      </WrapperProfiler>
    );
  }
  return <ul className="space-y-2 my-4">{items}</ul>;
});

function SlowItem({ text }: { text: string }) {
  const startTime = performance.now();
  while (performance.now() - startTime < 50) {
    // Do nothing for 1 ms per item to emulate extremely slow code
  }

  return (
    <li className="p-2">
      <span>Text: {text}</span>
    </li>
  );
}

function WrapperProfiler(props: { id: string; children: React.ReactNode }) {
  return (
    <React.Profiler
      {...props}
      onRender={profilerDataStore.recordProfilerData}
    />
  );
}

type ProfilerOnRender = React.ComponentProps<typeof React.Profiler>["onRender"];
type ProfilerPhase = Parameters<ProfilerOnRender>["1"];

class ProfilerDataStore {
  records: Map<
    string,
    {
      id: string;
      phase: ProfilerPhase;
      actualDuration: number;
      baseDuration: number;
      startTime: number;
      commitTime: number;
      formattedCommitTime: string;
    }[]
  >;
  isProfilingStarted: boolean;

  constructor() {
    this.records = new Map();
    this.isProfilingStarted = false;
  }

  startProfiling = () => {
    this.isProfilingStarted = true;
    const date = new Date();
    console.log("[Profiler] Started new profiling session:", date);
  };

  stopProfiling = () => {
    this.isProfilingStarted = false;
    const date = new Date();
    console.log("[Profiler] Ended profiling session:", date);
  };

  parse = () => {};

  recordProfilerData: ProfilerOnRender = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    if (!this.isProfilingStarted) {
      return;
    }

    const formattedCommitTime = formatMilliseconds(commitTime);

    const profile = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      formattedCommitTime,
    };

    const commitTimeRecords = this.records.get(formattedCommitTime) ?? [];

    if (!this.records.has(formattedCommitTime)) {
      this.records.set(formattedCommitTime, [profile]);
    } else {
      this.records.set(formattedCommitTime, [...commitTimeRecords, profile]);
    }
  };
}

// Helper function to format milliseconds to readable time
function formatMilliseconds(milliseconds: number): string {
  // For durations less than 1000ms, show in milliseconds with 2 decimal places
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(2)}ms`;
  }

  // For durations >= 1000ms, convert to seconds with 2 decimal places
  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(2)}s`;
}

const profilerDataStore = new ProfilerDataStore();
// profilerDataStore.startProfiling();

if (typeof window !== "undefined") {
  // @ts-expect-error - Expose profilerDataStore to window for debugging
  window.__profilerDataStore = profilerDataStore;
}
