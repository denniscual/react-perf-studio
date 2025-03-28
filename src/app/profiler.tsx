import React, { useMemo, useSyncExternalStore } from "react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  TooltipProps,
  Cell,
} from "recharts";
import { formatMilliseconds } from "./util";

export const ProfilerControls = React.memo(function ProfilerControls() {
  const [isProfilingStarted, setIsProfilingStarted] = React.useState(false);

  const handleToggleProfiling = React.useCallback(() => {
    const newState = !isProfilingStarted;
    setIsProfilingStarted(newState);
    if (newState) {
      profilerDataStore.startProfiling();
    } else {
      profilerDataStore.stopProfiling();
    }
  }, [isProfilingStarted]);

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

export function ProfilerGraph() {
  const records = useSyncExternalStore(
    profilerDataStore.subscribe,
    profilerDataStore.getSnapshot,
    profilerDataStore.getSnapshot
  );

  // Helper function to determine color based on duration
  const getDurationColor = (duration: number): string => {
    if (duration <= 10) return "#4ade80"; // Green for fastest (0-10ms)
    if (duration <= 50) return "#86efac"; // Less green for slight faster (10-50ms)
    if (duration <= 100) return "#fde047"; // Slight yellow for slight slower (50-100ms)
    if (duration <= 200) return "#facc15"; // Yellow for slower (100-200ms)
    return "#ef4444"; // Red for the worst (200ms+)
  };

  // Transform Map data into array format for the chart
  const commits = useMemo(() => {
    return Array.from(records.entries()).map(([commitTime, profiles]) => {
      // Calculate total duration for this commit
      const totalDuration = profiles.reduce(
        (sum, profile) => sum + profile.actualDuration,
        0
      );
      return {
        name: commitTime,
        duration: totalDuration,
        commitAt: commitTime,
        color: getDurationColor(totalDuration),
      };
    });
  }, [records]);

  // Check if we have data to display
  const hasCommits = commits.length > 0;

  const CommitBarTooltip = ({
    active,
    payload,
  }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-md rounded-md">
          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
            Committed at: {data.commitAt}
          </p>
          <p className="text-sm" style={{ color: data.color }}>
            Render duration: {formatMilliseconds(data.duration)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Commit Chart</h3>

      {!hasCommits ? (
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
              data={commits}
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
              <Tooltip content={<CommitBarTooltip />} />
              <Bar
                dataKey="duration"
                name="Render Duration"
                animationDuration={300}
                // Remove cursor pointer to avoid hover effect
                style={{ fillOpacity: 1 }}
                activeBar={{ fillOpacity: 0.9 }} // Subtle hover effect
              >
                {commits.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-2 flex items-center space-x-4 text-xs">
        <span className="flex items-center">
          <span
            className="h-3 w-3 inline-block mr-1 rounded"
            style={{ backgroundColor: "#4ade80" }}
          ></span>
          Fast (0-10ms)
        </span>
        <span className="flex items-center">
          <span
            className="h-3 w-3 inline-block mr-1 rounded"
            style={{ backgroundColor: "#86efac" }}
          ></span>
          Good (10-50ms)
        </span>
        <span className="flex items-center">
          <span
            className="h-3 w-3 inline-block mr-1 rounded"
            style={{ backgroundColor: "#fde047" }}
          ></span>
          Slow (50-100ms)
        </span>
        <span className="flex items-center">
          <span
            className="h-3 w-3 inline-block mr-1 rounded"
            style={{ backgroundColor: "#facc15" }}
          ></span>
          Slower (100-200ms)
        </span>
        <span className="flex items-center">
          <span
            className="h-3 w-3 inline-block mr-1 rounded"
            style={{ backgroundColor: "#ef4444" }}
          ></span>
          Very Slow (200ms+)
        </span>
      </div>

      <div>
        <h3 className="font-medium">Ranked Components</h3>
        {!hasCommits ? (
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

export function Profiler(props: { id: string; children: React.ReactNode }) {
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

export const profilerDataStore = new ProfilerDataStore();

if (typeof window !== "undefined") {
  // @ts-expect-error - Expose profilerDataStore to window for debugging
  window.__profilerDataStore = profilerDataStore;
}
