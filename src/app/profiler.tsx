"use client";
import React, {
  useMemo,
  useSyncExternalStore,
  useRef,
  useCallback,
  useEffect,
  useInsertionEffect,
} from "react";
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

export const ProfilerProviderContext = React.createContext<{
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

export function useProfilerProvider() {
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

export const ProfilerControls = React.memo(function ProfilerControls({
  replayer,
}: any) {
  const { isProfilingStarted, setIsProfilingStarted } = useProfilerProvider();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = React.useState<string | null>(null);
  const [profileName, setProfileName] = React.useState("");
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [showLoadDialog, setShowLoadDialog] = React.useState(false);
  const [availableSessions, setAvailableSessions] = React.useState<
    Array<{ id: string; name: string; createdAt: string }>
  >([]);
  const [selectedSession, setSelectedSession] = React.useState<string | null>(
    null
  );

  const handleToggleProfiling = React.useCallback(() => {
    const newState = !isProfilingStarted;
    setIsProfilingStarted(newState);

    if (newState) {
      profilerDataStore.startProfiling();
      // record rweb
      replayer.startRecording();
    } else {
      profilerDataStore.stopProfiling();
      // stop rweb recording
      replayer.stopRecording();
      // play recording. put it into timeout callback to make sure
      // the needed state for playing recording are all set.
      // flushSync is not working.
      setTimeout(() => {
        replayer.playRecording();
      }, 0);
    }
  }, [isProfilingStarted, setIsProfilingStarted, replayer]);

  const enableProfilingOnMountRef = useRef<any>(null);

  useInsertionEffect(() => {
    enableProfilingOnMountRef.current = () => {
      handleToggleProfiling();
    };
  });

  const enableProfilingOnMount = useCallback(() => {
    enableProfilingOnMountRef.current();
  }, []);

  useEffect(() => {
    enableProfilingOnMount();
  }, [enableProfilingOnMount]);

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

  // New function to handle saving profiler data to the API
  const handleSaveData = React.useCallback(async () => {
    if (!profileName.trim()) {
      setSaveError("Please enter a profile name");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      // Get the current profiler data
      const dataObj = {
        commits: Array.from(profilerDataStore.session.commits.entries()).map(
          ([time, profiles]) => ({
            id: time,
            profiles,
          })
        ),
      };

      // Make the API call
      const response = await fetch("/api/profiler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profileName,
          data: dataObj,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save profiler data");
      }

      setSaveSuccess(`Profile "${profileName}" saved successfully!`);
      setShowSaveDialog(false);
      setProfileName("");
    } catch (error) {
      console.error("Error saving profiler data:", error);
      setSaveError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsSaving(false);
    }
  }, [profileName]);

  // Function to fetch available sessions from the API
  const fetchAvailableSessions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/profiler");
      if (!response.ok) {
        throw new Error("Failed to fetch profiler sessions");
      }

      const data = await response.json();
      setAvailableSessions(data.sessions || []);

      if (data.sessions.length === 0) {
        setLoadError("No saved profiler sessions found.");
      }
    } catch (error) {
      console.error("Error fetching profiler sessions:", error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to fetch sessions"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to load a session by name
  const handleLoadSession = useCallback(async () => {
    if (!selectedSession) {
      setLoadError("Please select a session to load");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setLoadSuccess(null);

    try {
      const response = await fetch(
        `/api/profiler?name=${encodeURIComponent(selectedSession)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.statusText}`);
      }

      const sessionData = await response.json();

      if (!sessionData.data) {
        throw new Error("Invalid session data format");
      }

      const success = profilerDataStore.importData(sessionData.data);

      if (success) {
        setLoadSuccess(
          `Successfully loaded profiler session: ${selectedSession}`
        );
        setShowLoadDialog(false);
      } else {
        throw new Error("Failed to import session data");
      }
    } catch (error) {
      console.error("Error loading profiler session:", error);
      setLoadError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedSession]);

  // Function to open load dialog and fetch sessions
  const handleOpenLoadDialog = useCallback(() => {
    setShowLoadDialog(true);
    fetchAvailableSessions();
  }, [fetchAvailableSessions]);

  // Function to close save dialog
  const handleCloseSaveDialog = useCallback(() => {
    setShowSaveDialog(false);
    setProfileName("");
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  // Function to close load dialog
  const handleCloseLoadDialog = useCallback(() => {
    setShowLoadDialog(false);
    setSelectedSession(null);
    setLoadError(null);
  }, []);

  // Auto-dismiss success message after 3 seconds
  React.useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  React.useEffect(() => {
    if (loadSuccess) {
      const timer = setTimeout(() => {
        setLoadSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loadSuccess]);

  return (
    <div className="space-y-3">
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
          onClick={() => setShowSaveDialog(true)}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md focus:outline-none transition-colors"
        >
          Save to Server
        </button>
        <button
          onClick={handleOpenLoadDialog}
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-md focus:outline-none transition-colors"
        >
          Load from Server
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
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
      </div>

      {saveSuccess && (
        <div className="mt-2 p-2 bg-green-100 border border-green-400 text-green-700 rounded">
          {saveSuccess}
        </div>
      )}

      {loadSuccess && (
        <div className="mt-2 p-2 bg-green-100 border border-green-400 text-green-700 rounded">
          {loadSuccess}
        </div>
      )}

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save Profiler Data</h3>
            <div className="mb-4">
              <label
                htmlFor="profile-name"
                className="block text-sm font-medium mb-1"
              >
                Profile Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Enter a name for this profile"
                className="w-full p-2 border rounded-md"
                disabled={isSaving}
              />
              {saveError && (
                <p className="mt-1 text-sm text-red-600">{saveError}</p>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCloseSaveDialog}
                className="px-4 py-2 text-sm font-medium bg-gray-300 hover:bg-gray-400 rounded-md"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveData}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              Load Profiler Session
            </h3>

            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {availableSessions.length > 0 ? (
                  <div className="mb-4 max-h-60 overflow-y-auto">
                    <label className="block text-sm font-medium mb-2">
                      Select a saved profiler session:
                    </label>
                    <div className="space-y-2">
                      {availableSessions.map((session) => (
                        <div
                          key={session.id}
                          className={`p-2 border rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            selectedSession === session.name
                              ? "bg-blue-50 border-blue-500 dark:bg-blue-900"
                              : ""
                          }`}
                          onClick={() => setSelectedSession(session.name)}
                        >
                          <div className="font-medium">{session.name}</div>
                          <div className="text-xs text-gray-500">
                            Created:{" "}
                            {new Date(session.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    {loadError ||
                      "No sessions available. Save a profile first."}
                  </div>
                )}
              </>
            )}

            {loadError && !isLoading && availableSessions.length > 0 && (
              <p className="mt-1 mb-3 text-sm text-red-600">{loadError}</p>
            )}

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCloseLoadDialog}
                className="px-4 py-2 text-sm font-medium bg-gray-300 hover:bg-gray-400 rounded-md"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleLoadSession}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-md"
                disabled={
                  isLoading ||
                  !selectedSession ||
                  availableSessions.length === 0
                }
              >
                {isLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
        </div>
      )}
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

// Future improvement:
// - Implement a "Rendering At Timeline" feature in Ranked Components section to display
//   the exact timestamp when each component was rendered during the profiling session.
//   "Rendered At" will be shown if a Component is selected in the Ranked Components chart.
export function ProfilerGraph() {
  const { commits: commitsMap } = useSyncExternalStore(
    profilerDataStore.subscribe,
    profilerDataStore.getSnapshot,
    profilerDataStore.getSnapshot
  );
  const { isProfilingStarted } = useProfilerProvider();
  const [selectedCommitIndex, setSelectedCommitIndex] = React.useState(0);

  // Transform into format for the chart
  const commits: CommitData[] = useMemo(() => {
    return Array.from(commitsMap.entries()).map(([commitTime, profiles]) => {
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
  }, [commitsMap]);

  const selectedCommit = commits[selectedCommitIndex];

  const hasCommits = commits.length > 0;

  // Calculate ranked component data for the selected commit
  const rankedComponents = useMemo(() => {
    if (!selectedCommit) return [] as ComponentStat[];

    // Get profiles for the selected commit
    const commitProfiles = commitsMap.get(selectedCommit.id);

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
  }, [commitsMap, selectedCommit]);

  const handlePrevCommit = useCallback(() => {
    if (selectedCommitIndex > 0) {
      setSelectedCommitIndex(selectedCommitIndex - 1);
    }
  }, [selectedCommitIndex]);

  const handleNextCommit = useCallback(() => {
    if (selectedCommitIndex < commits.length - 1) {
      setSelectedCommitIndex(selectedCommitIndex + 1);
    }
  }, [commits.length, selectedCommitIndex]);

  const commitsNavControl = useMemo(() => {
    return (
      <div className="mt-2 flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <>
            <button
              onClick={handlePrevCommit}
              disabled={selectedCommitIndex <= 0}
              className={`p-1 rounded-md ${
                selectedCommitIndex <= 0
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900"
              }`}
              aria-label="Previous commit"
              title="Previous commit"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <span className="text-xs text-gray-500">
              Commit {selectedCommitIndex + 1} of {commits.length}
            </span>
            <button
              onClick={handleNextCommit}
              disabled={
                selectedCommitIndex === null ||
                selectedCommitIndex >= commits.length - 1
              }
              className={`p-1 rounded-md ${
                selectedCommitIndex === null ||
                selectedCommitIndex >= commits.length - 1
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900"
              }`}
              aria-label="Next commit"
              title="Next commit"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 011.414-1.414l4 4a1 1 010 1.414l-4 4a1 1 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(durationStatusLabels).map(([status, label]) => (
            <span key={status} className="flex items-center">
              <span
                className="h-3 w-3 inline-block mr-1 rounded"
                style={{
                  backgroundColor:
                    durationStatusColors[status as DurationStatus],
                }}
              ></span>
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }, [commits.length, handleNextCommit, handlePrevCommit, selectedCommitIndex]);

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
      {commitsNavControl}
      <div
        style={{ width: "100%", height: 200 }}
        className="border rounded-md p-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={commits}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            onClick={(data) => {
              if (data && data.activePayload && data.activePayload.length > 0) {
                const index = data.activeTooltipIndex;
                setSelectedCommitIndex(index !== undefined ? index : 0);
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
                    selectedCommitIndex === index
                      ? "#3b82f6" // blue color when selected
                      : durationStatusColors[entry.status]
                  }
                  fillOpacity={selectedCommitIndex === index ? 1 : 0.7}
                  stroke={selectedCommitIndex === index ? "#2563eb" : "none"}
                  strokeWidth={selectedCommitIndex === index ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-medium">Ranked Components</h3>
          {selectedCommit && (
            <div className="text-sm text-gray-500">
              For commit at: {selectedCommit.id}
            </div>
          )}
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
          <b className="font-bold">Base duration</b>:{" "}
          {formatMilliseconds(data.baseDuration)}
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

type ProfilerData = {
  id: string;
  phase: ProfilerPhase;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  formattedCommitTime: string;
};
type ProfilerOnRender = React.ComponentProps<typeof React.Profiler>["onRender"];
type ProfilerPhase = Parameters<ProfilerOnRender>["1"];
type ProfilerRecords = Map<string, ProfilerData[]>;
type ProfilerRenders = Map<number, ProfilerData>;
type Profiles = ProfilerData[];
type ProfilerSession = {
  profiles: Profiles;
  commits: ProfilerRecords;
  renders: ProfilerRenders;
};
type ProfilerSubscriber = (
  // eslint-disable-next-line no-unused-vars
  session: ProfilerSession
) => void;
type ProfilerExportedData = {
  commits: {
    id: string; // This is the commit time.
    profiles: Profiles;
  }[];
};

class ProfilerDataStore {
  session: ProfilerSession;
  isProfilingStarted: boolean;
  subscribers: Map<ProfilerSubscriber, ProfilerSubscriber>;

  constructor() {
    this.session = {
      profiles: [],
      commits: new Map(),
      renders: new Map(),
    };
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

    const newProfiles = this.setProfiles(profile);
    const newCommits = this.setCommits(profile);
    const newRenders = this.setRenders(newProfiles);

    this.session = {
      profiles: newProfiles,
      commits: newCommits,
      renders: newRenders,
    };

    this.subscribers.forEach((callback) => {
      callback(this.session);
    });
  };

  setProfilerSession = (session: ProfilerSession) => {
    this.session = session;
  };

  setProfiles = (profile: ProfilerData) => {
    const newProfiles = [...this.session.profiles, profile];
    return newProfiles;
  };

  setCommits = (profile: ProfilerData) => {
    const formattedCommitTime = formatMilliseconds(profile.commitTime);
    const newRecords = new Map(this.session.commits);

    const commitTimeRecords = newRecords.get(formattedCommitTime) ?? [];

    if (!newRecords.has(formattedCommitTime)) {
      newRecords.set(formattedCommitTime, [profile]);
    } else {
      newRecords.set(formattedCommitTime, [...commitTimeRecords, profile]);
    }

    return newRecords;
  };

  setRenders = (profiles: Profiles) => {
    const sortedProfiles = [...profiles].sort(
      (a, b) => a.startTime - b.startTime
    );

    return sortedProfiles.reduce((acc, value) => {
      acc.set(value.startTime, value);
      return acc;
    }, new Map() as ProfilerRenders);
  };

  resetSession = () => {
    this.session = {
      profiles: [],
      commits: new Map(),
      renders: new Map(),
    };
  };

  clearData = () => {
    this.resetSession();

    // Notify subscribers of the change
    this.subscribers.forEach((callback) => {
      callback(this.session);
    });
  };

  exportData = () => {
    const { commits } = this.session;
    const data: ProfilerExportedData = {
      commits: Array.from(commits.entries()).map(([time, profiles]) => ({
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

      // Clear existing data
      this.clearData();

      // Import commits.
      data.commits.forEach((commit) => {
        if (commit.id && Array.isArray(commit.profiles)) {
          this.session.commits.set(commit.id, commit.profiles);
        }
      });

      // Import profiles

      // Import renders

      console.log(
        `[Profiler] Imported data with ${this.session.commits.size} commits`
      );

      // Notify subscribers of the change
      this.subscribers.forEach((callback) => {
        callback(this.session);
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
    return this.session;
  };
}

export const profilerDataStore = new ProfilerDataStore();

if (typeof window !== "undefined") {
  // @ts-expect-error - Expose profilerDataStore to window for debugging
  window.__profilerDataStore = profilerDataStore;
}
