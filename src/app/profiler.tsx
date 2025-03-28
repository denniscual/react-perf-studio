import React, { useMemo, useSyncExternalStore, useRef } from "react";
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

const ProfilerProviderContext = React.createContext<{
  isProfilingStarted: boolean;
  setIsProfilingStarted: React.Dispatch<React.SetStateAction<boolean>>;
} | null>(null);

export function ProfilerProvider(props: React.PropsWithChildren) {
  const [isProfilingStarted, setIsProfilingStarted] = React.useState(false);

  const value = useMemo(() => {
    return {
      isProfilingStarted,
      setIsProfilingStarted,
    };
  }, [isProfilingStarted]);

  return <ProfilerProviderContext value={value} {...props} />;
}

function useProfilerProvider() {
  const ctx = React.useContext(ProfilerProviderContext);
  if (!ctx) {
    throw new Error(
      '"useProfilerProvider" must be used within "ProfilerProvider"'
    );
  }
  return ctx;
}

// Define duration status types
type DurationStatus = "fast" | "good" | "slow" | "slower" | "verySlow";

// Helper function to determine duration status based on thresholds
const getDurationStatus = (duration: number): DurationStatus => {
  if (duration <= 10) return "fast"; // 0-10ms
  if (duration <= 50) return "good"; // 10-50ms
  if (duration <= 100) return "slow"; // 50-100ms
  if (duration <= 200) return "slower"; // 100-200ms
  return "verySlow"; // 200ms+
};

// Map status to color
const durationStatusColors: Record<DurationStatus, string> = {
  fast: "#4ade80", // Green
  good: "#86efac", // Light green
  slow: "#fde047", // Light yellow
  slower: "#facc15", // Yellow
  verySlow: "#ef4444", // Red
};

// Map status to human-readable label
const durationStatusLabels: Record<DurationStatus, string> = {
  fast: "Fast (0-10ms)",
  good: "Good (10-50ms)",
  slow: "Slow (50-100ms)",
  slower: "Slower (100-200ms)",
  verySlow: "Very Slow (200ms+)",
};

export const ProfilerControls = React.memo(function ProfilerControls() {
  const { isProfilingStarted, setIsProfilingStarted } = useProfilerProvider();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleProfiling = React.useCallback(() => {
    const newState = !isProfilingStarted;
    setIsProfilingStarted(newState);
    if (newState) {
      profilerDataStore.startProfiling();
    } else {
      profilerDataStore.stopProfiling();
    }
  }, [isProfilingStarted, setIsProfilingStarted]);

  const handleResetData = React.useCallback(() => {
    profilerDataStore.clearData();
  }, []);

  const handleExportData = React.useCallback(() => {
    const jsonData = profilerDataStore.exportData();
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create a temporary link and trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = `react-profiler-data-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleUploadClick = React.useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target?.result as string);
          profilerDataStore.importData(jsonData);
          // Reset the input so the same file can be uploaded again if needed
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error) {
          console.error("Failed to parse profiler data:", error);
          alert(
            "Invalid profiler data format. Please select a valid JSON file."
          );
        }
      };
      reader.readAsText(file);
    },
    []
  );

  return (
    <div className="flex flex-wrap gap-2">
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
      <button
        onClick={handleExportData}
        className="px-4 py-2 text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 rounded-md focus:outline-none transition-colors"
      >
        Export Data
      </button>
      <button
        onClick={handleUploadClick}
        className="px-4 py-2 text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 rounded-md focus:outline-none transition-colors"
      >
        Upload Data
      </button>
      <button
        onClick={handleResetData}
        className="px-4 py-2 text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 rounded-md focus:outline-none transition-colors"
      >
        Reset Data
      </button>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
    </div>
  );
});

type CommitData = {
  id: string;
  name: string;
  slowestProfile: ProfilerData;
  duration: number; // Duration of the slowest profile in the commit.
  commitAt: string;
  status: DurationStatus;
};

type ComponentStat = {
  id: string;
  actualDuration: number;
  baseDuration: number;
  phase: ProfilerPhase;
  status: DurationStatus;
};

export function ProfilerGraph() {
  const records = useSyncExternalStore(
    profilerDataStore.subscribe,
    profilerDataStore.getSnapshot,
    profilerDataStore.getSnapshot
  );
  const { isProfilingStarted } = useProfilerProvider();

  // State to track which commit is selected
  const [selectedCommit, setSelectedCommit] = React.useState<string | null>(
    null
  );

  // Transform Map data into array format for the chart
  const commits: CommitData[] = useMemo(() => {
    return Array.from(records.entries()).map(([commitTime, profiles]) => {
      const slowestProfile = [...profiles].sort(
        (a, b) => b.actualDuration - a.actualDuration
      )[0];
      const status = getDurationStatus(slowestProfile.actualDuration);
      return {
        id: commitTime,
        name: commitTime,
        duration: slowestProfile.actualDuration,
        slowestProfile,
        commitAt: commitTime,
        status: status,
      };
    });
  }, [records]);

  // Check if we have data to display
  const hasCommits = commits.length > 0;

  // Calculate ranked component data for the selected commit
  const rankedComponents = useMemo(() => {
    if (!selectedCommit) return [] as ComponentStat[];

    // Get profiles for the selected commit
    const commitProfiles = records.get(selectedCommit);
    if (!commitProfiles || commitProfiles.length === 0)
      return [] as ComponentStat[];

    return commitProfiles
      .map(({ id, actualDuration, baseDuration, phase }) => {
        return {
          id,
          actualDuration,
          baseDuration: baseDuration,
          phase: phase,
          status: getDurationStatus(actualDuration),
        };
      })
      .sort((a, b) => b.actualDuration - a.actualDuration);
  }, [records, selectedCommit]);

  if (!hasCommits || isProfilingStarted) {
    return (
      <div className="text-gray-500 italic p-4 border rounded-md">
        No profiling data available yet. Start profiling and interact with your
        application to see performance data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mt-2 flex flex-row-reverse flex-wrap gap-2 text-xs">
        {Object.entries(durationStatusLabels).map(([status, label]) => (
          <span key={status} className="flex items-center">
            <span
              className="h-3 w-3 inline-block mr-1 rounded"
              style={{
                backgroundColor: durationStatusColors[status as DurationStatus],
              }}
            ></span>
            {label}
          </span>
        ))}
      </div>
      <div
        style={{ width: "100%", height: 200 }}
        className="border rounded-md p-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={commits}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            onClick={(data) => {
              if (data.activePayload && data.activePayload.length > 0) {
                const { id } = data.activePayload[0].payload as CommitData;
                setSelectedCommit(id);
              }
            }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              height={40}
              interval={0}
              angle={-45}
              textAnchor="end"
              label={{
                value: "Commit Time",
              }}
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
              style={{ fillOpacity: 1 }}
              activeBar={{ fillOpacity: 0.9 }}
              cursor="pointer"
            >
              {commits.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    selectedCommit === entry.id
                      ? "#3b82f6" // blue color when selected
                      : durationStatusColors[entry.status]
                  }
                  fillOpacity={selectedCommit === entry.commitAt ? 1 : 0.7}
                  stroke={
                    selectedCommit === entry.commitAt ? "#2563eb" : "none"
                  }
                  strokeWidth={selectedCommit === entry.commitAt ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-medium">Ranked Components</h3>
        </div>
        {!selectedCommit ? (
          <div className="text-gray-500 italic p-4 border rounded-md">
            Click on a commit bar above to see its components.
          </div>
        ) : rankedComponents.length === 0 ? (
          <div className="text-gray-500 italic">
            No component data available for this commit.
          </div>
        ) : (
          <RankedComponentsChart data={rankedComponents} />
        )}
      </div>
    </div>
  );
}

function RankedComponentsChart({ data }: { data: ComponentStat[] }) {
  const topComponents = data;

  return (
    <div
      style={{ width: "100%", height: 300 }}
      className="border rounded-md p-2"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={topComponents}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 100, bottom: 20 }}
        >
          <XAxis
            type="number"
            label={{
              value: "Render Duration (ms)",
              position: "bottom",
              offset: 0,
            }}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="id"
            tick={{ fontSize: 10 }}
            width={100}
          />
          <Tooltip content={<ComponentTooltip />} />
          <Bar
            dataKey="actualDuration"
            name="Render Duration"
            animationDuration={300}
          >
            {topComponents.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={durationStatusColors[entry.status]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CommitBarTooltip({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as CommitData;
    const status = data.status;
    const slowestComponent = data.slowestProfile;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-md rounded-md">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
          Committed at: {data.commitAt}
        </p>
        <div className="mt-2 border-t pt-2 dark:border-gray-700">
          <p className="text-sm">
            <b className="font-bold">Slowest duration</b>:{" "}
            <span style={{ color: durationStatusColors[status] }}>
              {formatMilliseconds(slowestComponent.actualDuration)}
            </span>
          </p>
        </div>
        <p className="text-xs mt-1 text-gray-500">
          <b className="font-bold">Status</b>: {durationStatusLabels[status]}
        </p>
      </div>
    );
  }

  return null;
}

function ComponentTooltip({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as {
      id: string;
      actualDuration: number;
      baseDuration: number;
      phase: ProfilerPhase;
      status: DurationStatus;
    };
    const status = data.status;

    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-md rounded-md">
        <p className="font-bold text-sm text-gray-900 dark:text-gray-100">
          {data.id}
        </p>
        <p className="text-sm">
          <b className="font-bold">Render duration</b>:{" "}
          {formatMilliseconds(data.actualDuration)}
        </p>
        <p className="text-sm">
          <b className="font-bold">Phase</b>: {data.phase}
        </p>
        <p className="text-xs mt-1 text-gray-500">
          <b className="font-bold">Status</b>: {durationStatusLabels[status]}
        </p>
      </div>
    );
  }
  return null;
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
type ProfilerExportedData = {
  commits: {
    id: string; // This is the commit time.
    profiles: ProfilerData[];
  }[];
};

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

  clearData = () => {
    this.records = new Map();
    // Notify subscribers of the change
    this.subscribers.forEach((callback) => {
      callback(this.records);
    });
  };

  exportData = () => {
    const data: ProfilerExportedData = {
      commits: Array.from(this.records.entries()).map(([time, profiles]) => ({
        id: time,
        profiles,
      })),
    };

    return JSON.stringify(data, null, 2);
  };

  importData = (data: ProfilerExportedData) => {
    try {
      if (!data.commits || !Array.isArray(data.commits)) {
        throw new Error("Invalid data format");
      }

      // Clear existing records
      this.records = new Map();

      // Import the data
      data.commits.forEach((commit) => {
        if (commit.id && Array.isArray(commit.profiles)) {
          this.records.set(commit.id, commit.profiles);
        }
      });

      console.log(`[Profiler] Imported data with ${this.records.size} commits`);

      // Notify subscribers of the change
      this.subscribers.forEach((callback) => {
        callback(this.records);
      });

      return true;
    } catch (error) {
      console.error("[Profiler] Failed to import data:", error);
      return false;
    }
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
