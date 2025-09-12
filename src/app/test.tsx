"use client";
import {
  instrument,
  secure,
  traverseRenderedFibers,
  getTimings,
  getDisplayName,
  Fiber,
  MemoizedState,
} from "bippy"; // must be imported BEFORE react
import React, { useCallback, useEffect } from "react";
import SessionRecorder from "./replayer";
import { Timeline } from "@/components/timeline";
import { EventTrack, TimelineEvent } from "@/components/timeline/renderer";
import { TestComponent } from "@/components/test-component";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play, Square, Activity, Monitor, Timer } from "lucide-react";

export default function TestList() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            React Performance Monitor
          </h1>
        </div>

        <Separator />

        <SessionRecorder>
          {(replayer) => (
            <div className="space-y-6">
              {/* Test Playground Section - Full Width */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <CardTitle>Test Playground</CardTitle>
                  </div>
                  <CardDescription>
                    Interactive test environment for triggering React renders and performance events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TestComponent />
                </CardContent>
              </Card>

              {/* Performance Profiler Section - Full Width */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-green-600" />
                    <CardTitle>Performance Profiler</CardTitle>
                  </div>
                  <CardDescription>
                    Start profiling to capture render timings, user interactions, and network requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProfilerTimelineEventTracks>
                    {({
                      eventTracks,
                      setEventTracks,
                      profilingSessionStatus,
                      setProfilingSessionStatus,
                      eventTracksRef,
                    }) => (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={profilingSessionStatus === "pending" ? "destructive" : "secondary"}
                              className="capitalize"
                            >
                              {profilingSessionStatus === "pending" ? "Recording" : "Idle"}
                            </Badge>
                            {profilingSessionStatus === "pending" && (
                              <div className="flex items-center gap-1 text-sm text-slate-600">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                Live Recording
                              </div>
                            )}
                          </div>
                          <Button
                            onClick={() => {
                              const newStatus =
                                profilingSessionStatus !== "pending"
                                  ? "pending"
                                  : "stop";

                              if (newStatus === "stop") {
                                setEventTracks(new Map(eventTracksRef.current));
                                eventTracksRef.current = initEventTracks();
                                replayer.stopRecording();

                                setTimeout(() => {
                                  replayer.playRecording();
                                }, 0);
                              } else {
                                setEventTracks(initEventTracks());
                                eventTracksRef.current = initEventTracks();
                                replayer.startRecording();
                              }

                              setProfilingSessionStatus(newStatus);
                            }}
                            variant={profilingSessionStatus !== "pending" ? "default" : "destructive"}
                            className="min-w-32"
                          >
                            {profilingSessionStatus !== "pending" ? (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Start Profiling
                              </>
                            ) : (
                              <>
                                <Square className="w-4 h-4 mr-2" />
                                Stop Profiling
                              </>
                            )}
                          </Button>
                        </div>
                        <ProfilerTimeline
                          eventTracks={eventTracks}
                          setEventTracks={setEventTracks}
                          profilingSessionStatus={profilingSessionStatus}
                          eventTracksRef={eventTracksRef}
                          replayer={replayer}
                        />
                      </div>
                    )}
                  </ProfilerTimelineEventTracks>
                </CardContent>
              </Card>

              {/* Session Recorder Section - Full Width */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-purple-600" />
                    <CardTitle>Session Replay</CardTitle>
                  </div>
                  <CardDescription>
                    DOM recording synchronized with performance timeline for debugging
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                    <div ref={replayer.playerRef} className="min-h-[300px]">
                      {replayer.events.length === 0 && (
                        <div className="flex items-center justify-center h-64 text-slate-500">
                          <div className="text-center space-y-2">
                            <Monitor className="w-12 h-12 mx-auto opacity-50" />
                            <p>No recording available</p>
                            <p className="text-sm">Start profiling to begin session recording</p>
                          </div>
                        </div>
                      )}
                      {replayer.events.length > 0 && (
                        <div className="w-full h-auto bg-white dark:bg-slate-800 rounded-lg" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </SessionRecorder>
      </div>
    </div>
  );
}

function ProfilerTimeline({
  eventTracks,
  setEventTracks,
  replayer,
  profilingSessionStatus,
  eventTracksRef,
}: {
  eventTracks: Map<string, EventTrack>;
  setEventTracks: React.Dispatch<React.SetStateAction<Map<string, EventTrack>>>;
  replayer: any;
  profilingSessionStatus: ProfilingSessionStatus;
  eventTracksRef: React.RefObject<Map<string, EventTrack>>;
}) {
  // Reference to store the baseline timestamp when profiling starts
  const baselineTimestampRef = React.useRef<number | null>(null);

  // Effect to initialize the baseline timestamp when profiling starts
  useEffect(() => {
    if (
      profilingSessionStatus === "pending" &&
      baselineTimestampRef.current === null
    ) {
      // Set the baseline timestamp when profiling starts
      baselineTimestampRef.current = performance.now();

      // Clear previous events when starting a new profiling session
      setEventTracks(initEventTracks());
    }

    // Reset the baseline when profiling stops
    if (profilingSessionStatus === "stop") {
      baselineTimestampRef.current = null;
    }
  }, [setEventTracks, profilingSessionStatus]);

  // Calculate relative time from the baseline
  const getRelativeTime = useCallback((absoluteTime: number): number => {
    if (baselineTimestampRef.current === null) return absoluteTime;
    return absoluteTime - baselineTimestampRef.current;
  }, []);

  const addTimelineEvent = React.useCallback(
    (event: TimelineEvent) => {
      const eventTracks = eventTracksRef.current;
      const eventTrack = eventTracks.get(event.eventTrackId);

      if (!eventTrack) return;

      eventTracks.set(event.eventTrackId, {
        ...eventTrack,
        events: [...eventTrack.events, event],
      });

      eventTracksRef.current = new Map(eventTracks);
    },
    [eventTracksRef],
  );

  // TODO:
  // - Use bippy package instead of react-scan to access lower-level apis like traverseRenderedFibers.
  // - for rendered events, add "Rendering reason" feature. This tells why this Component gets rerendered. E.g the props/state/context change.
  useEffect(() => {
    if (profilingSessionStatus !== "pending") return;

    instrument(
      secure({
        onCommitFiberRoot(_, root) {
          traverseRenderedFibers(root, (fiber) => {
            if (!fiber.actualStartTime) {
              return;
            }

            const displayName = getDisplayName(fiber) ?? "Unknown";
            const { selfTime } = getTimings(fiber);
            const startTime = getRelativeTime(fiber.actualStartTime);

            if (startTime < 0 || selfTime < 1) return;

            const componentStateVariables = getAllComponentState(fiber);
            console.log({
              componentStateVariables,
              displayName,
              fiber,
            });

            const event = {
              id: `${displayName}-${roundTime(startTime)}`,
              label: displayName,
              startTime: roundTime(startTime),
              endTime: roundTime(startTime + selfTime),
              duration: roundTime(selfTime),
              eventTrackId: "render",
            };

            addTimelineEvent(event);
          });
        },
      }),
    );
  }, [addTimelineEvent, getRelativeTime, profilingSessionStatus]);

  useEffect(
    function observeEventTiming() {
      if (profilingSessionStatus !== "pending") {
        return;
      }

      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const id = Date.now();

          // Adjust the times relative to our baseline
          const relativeStartTime = getRelativeTime(entry.startTime);

          if (relativeStartTime < 0) return;

          const event = {
            id: `${entry.name}-${id}`,
            label: entry.name,
            startTime: roundTime(relativeStartTime),
            endTime: roundTime(relativeStartTime + entry.duration),
            duration: roundTime(entry.duration),
            eventTrackId: "user-input",
          };

          addTimelineEvent(event);
        });
      });

      // Register the observer for events
      observer.observe({
        type: "event",
        buffered: true,
        // @ts-expect-error expect error
        durationThreshold: 0,
      });

      return () => observer.disconnect();
    },
    [addTimelineEvent, getRelativeTime, profilingSessionStatus],
  );

  useEffect(
    function observeResourceTiming() {
      if (profilingSessionStatus !== "pending") {
        return;
      }

      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry, idx) => {
          if (!(entry instanceof PerformanceResourceTiming)) return;
          if (!isResourceIncludedInWhiteList(entry)) return;

          // Adjust the times relative to our baseline
          const relativeFetchStart = getRelativeTime(entry.fetchStart);
          const relativeResponseEnd = getRelativeTime(entry.responseEnd);

          if (relativeFetchStart < 0) return;

          const event = {
            id: `${entry.name}-${idx}`,
            label: entry.name,
            startTime: roundTime(relativeFetchStart),
            endTime: roundTime(relativeResponseEnd),
            duration: roundTime(relativeResponseEnd - relativeFetchStart),
            eventTrackId: "network-resource",
          };

          addTimelineEvent(event);
        });
      });

      // Register the observer for events
      observer.observe({
        type: "resource",
        buffered: true,
      });

      return () => observer.disconnect();
    },
    [addTimelineEvent, getRelativeTime, profilingSessionStatus],
  );

  const tracksArray = Array.from(eventTracks.values());
  const totalEvents = tracksArray.reduce((sum, track) => sum + track.events.length, 0);

  return (
    <div className="space-y-4">
      {profilingSessionStatus === "stop" && tracksArray.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Performance Timeline Ready
              </span>
            </div>
            <Badge variant="outline" className="text-green-700 dark:text-green-300 border-green-300">
              {totalEvents} events captured
            </Badge>
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-white dark:bg-slate-900">
            <Timeline
              tracks={tracksArray}
              onEventClick={(event) => {
                replayer.jumpToTime(event.startTime);
              }}
              currentTime={replayer.currentTime}
              isPlaying={replayer.isPlaying}
            />
          </div>
        </div>
      ) : profilingSessionStatus === "pending" ? (
        <div className="flex items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-slate-600 dark:text-slate-400">Recording performance events...</span>
            </div>
            <p className="text-sm text-slate-500">
              Interact with the test components to capture performance data
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="text-center space-y-2">
            <Timer className="w-8 h-8 mx-auto text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400">No performance data</span>
            <p className="text-sm text-slate-500">
              Start profiling to capture performance events and visualize them on the timeline
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

type ProfilingSessionStatus = "init" | "pending" | "stop";

function ProfilerTimelineEventTracks({
  children,
}: {
  children: (props: {
    eventTracks: Map<string, EventTrack>;
    setEventTracks: React.Dispatch<
      React.SetStateAction<Map<string, EventTrack>>
    >;
    profilingSessionStatus: ProfilingSessionStatus;
    setProfilingSessionStatus: React.Dispatch<
      React.SetStateAction<ProfilingSessionStatus>
    >;
    eventTracksRef: React.RefObject<Map<string, EventTrack>>;
  }) => React.ReactNode;
}) {
  const [eventTracks, setEventTracks] = React.useState<Map<string, EventTrack>>(
    () => {
      return initEventTracks();
    },
  );
  const [profilingSessionStatus, setProfilingSessionStatus] = React.useState<
    "init" | "pending" | "stop"
  >("init");
  // Create a ref to store the event eventTracks to avoid infinite re-renders caused by react-scan.
  const eventTracksRef = React.useRef<Map<string, EventTrack>>(eventTracks);

  return children({
    eventTracks,
    setEventTracks,
    profilingSessionStatus,
    setProfilingSessionStatus,
    eventTracksRef,
  });
}

function initEventTracks() {
  const defaultValue: [string, EventTrack][] = [
    [
      "network-resource",
      {
        id: "network-resource",
        label: "Network Requests",
        color: "rgb(64, 192, 87)",
        events: [],
      },
    ],
    [
      "user-input",
      {
        id: "user-input",
        label: "User Inputs",
        color: "#ed64a6",
        events: [],
      },
    ],
    [
      "render",
      {
        id: "render",
        label: "Renders",
        color: "#4299e1",
        events: [],
      },
    ],
  ];
  return new Map<string, EventTrack>(defaultValue);
}

function isResourceIncludedInWhiteList(entry: PerformanceResourceTiming) {
  const url = new URL(entry.name, window.location.origin);
  const pathname = url.pathname.toLowerCase();
  const isJson =
    pathname.endsWith(".json") ||
    entry.name.includes("/json") ||
    entry.initiatorType === "fetch";
  const isScript = pathname.endsWith(".js");
  const isCss = pathname.endsWith(".css");
  const isImg = pathname.endsWith(".img");
  const isFetchInitiator = entry.initiatorType === "fetch";

  return isJson || isScript || isCss || isImg || isFetchInitiator;
}

function roundTime(time: number): number {
  return Math.round(time * 100) / 100;
}

function getAllComponentState(fiber: Fiber) {
  const statefulHooks = ["useState", "useReducer"];
  const states: {
    id: number;
    type: string;
    prev: unknown;
    next: unknown;
  }[] = [];

  // Get the hook linked list from fiber.memoizedState
  let nextState: MemoizedState | undefined | null = fiber.memoizedState;
  let prevState: MemoizedState | undefined | null =
    fiber.alternate?.memoizedState;
  let hookIndex = 0;

  // Get debug hook types if available (DEV mode)
  const debugHookTypes = fiber._debugHookTypes || [];

  while (nextState || prevState) {
    const hookType = debugHookTypes[hookIndex] || "unknown";

    if (statefulHooks.includes(hookType)) {
      states.push({
        id: hookIndex + 1,
        type: hookType,
        prev: prevState?.memoizedState, // state value
        next: nextState?.memoizedState, // state value
      });
    }

    nextState = nextState?.next;
    prevState = prevState?.next;
    hookIndex++;
  }

  return states;
}
