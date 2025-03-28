"use client";
import React, { useMemo, useSyncExternalStore } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis } from "recharts";

// Helper function to simulate computational delay
function simulateDelay(milliseconds: number = 50): void {
  const startTime = performance.now();
  while (performance.now() - startTime < milliseconds) {
    // Busy wait to simulate CPU-intensive work
  }
}

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
            <ProfilerGraph />
            {/* <ProfilerView profilerDataStore={profilerDataStore} /> */}
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

function ProfilerGraph() {
  const records = useSyncExternalStore(
    profilerDataStore.subscribe,
    profilerDataStore.getSnapshot,
    profilerDataStore.getSnapshot
  );

  // Transform Map data into array format for the chart
  const data = useMemo(() => {
    return Array.from(records.entries()).map(([commitTime, profiles]) => {
      // Calculate total duration for this commit
      const totalDuration = profiles.reduce(
        (sum, profile) => sum + profile.actualDuration,
        0
      );
      return {
        name: commitTime,
        duration: totalDuration, // Using a more descriptive key name
      };
    });
  }, [records]);

  // Check if we have data to display
  const hasData = data.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Commit Chart</h3>

      {!hasData ? (
        <div className="text-gray-500 italic">
          No chart data available yet. Start profiling and interact with the
          list to see data.
        </div>
      ) : (
        <div
          style={{ width: "100%", height: 200 }}
          className="border rounded-md p-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                height={40}
                interval={0}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                label={{
                  value: "Duration (ms)",
                  angle: -90,
                  position: "insideLeft",
                }}
                tick={{ fontSize: 10 }}
              />
              <Bar dataKey="duration" fill="#8884d8" name="Render Duration" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <h3 className="font-medium">Ranked Components</h3>
        {!hasData ? (
          <div className="text-gray-500 italic">
            No component data available yet.
          </div>
        ) : (
          <div>Component ranking will appear here</div>
        )}
      </div>
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
  return (
    <div>
      <ul className="space-y-2 my-4">{items}</ul>
      {text.includes("y") && (
        <WrapperProfiler id="SlowComponent">
          <SlowComponent />
        </WrapperProfiler>
      )}
    </div>
  );
});

function SlowComponent() {
  // Use the reusable delay function with a longer delay
  simulateDelay(120);
  return <div>Slow Component</div>;
}

function SlowItem({ text }: { text: string }) {
  // Use the reusable delay function with default delay
  simulateDelay();

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
type ProfilerRecords = Map<string, ProfilerData[]>;
type ProfilerData = {
  id: string;
  phase: ProfilerPhase;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  formattedCommitTime: string;
};
type ProfilerSubscriber = (records: ProfilerRecords) => void;

class ProfilerDataStore {
  records: ProfilerRecords;
  isProfilingStarted: boolean;
  subscribers: Map<ProfilerSubscriber, ProfilerSubscriber>;

  constructor() {
    this.records = new Map();
    this.isProfilingStarted = false;
    this.subscribers = new Map();
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

    const newRecords = new Map(this.records);

    const commitTimeRecords = newRecords.get(formattedCommitTime) ?? [];

    if (!newRecords.has(formattedCommitTime)) {
      newRecords.set(formattedCommitTime, [profile]);
    } else {
      newRecords.set(formattedCommitTime, [...commitTimeRecords, profile]);
    }

    this.records = newRecords;

    // Notify subscribers with the new profiler data
    this.subscribers.forEach((callback) => {
      callback(newRecords);
    });
  };

  subscribe = (callback: ProfilerSubscriber) => {
    this.subscribers.set(callback, callback);

    return () => {
      this.subscribers.delete(callback);
    };
  };

  getSnapshot = () => {
    return this.records;
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
