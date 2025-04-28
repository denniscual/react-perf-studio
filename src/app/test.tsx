"use client";
import React, { memo, useCallback, useEffect, useState } from "react";
import { simulateDelay } from "./util";
import { ProfilerControls, ProfilerGraph, ProfilerProvider } from "./profiler";
// import Timeline from "./timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SessionRecorder from "./replayer";
import { scan } from "react-scan";
import { Timeline } from "@/components/timeline";
import { EventTrack } from "@/components/timeline/renderer";

export default function TestList() {
  return (
    <ProfilerProvider>
      <SessionRecorder>
        {(replayer) => (
          <div className="space-y-4 p-4">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-6">Profiler</h2>
                <ProfilerControls replayer={replayer} />
              </div>
              <div className="w-1/2">
                <Foo />
                <TestComponent />
              </div>
            </div>
            <div className="flex flex-row space-x-6">
              <div className="w-1/2">
                <div ref={replayer.playerRef}>
                  {replayer.events.length > 0 && (
                    <div className="w-full h-auto border border-gray-300 rounded-lg bg-white shadow" />
                  )}
                </div>
              </div>
              <div className="w-1/2">
                <Tabs defaultValue="timeline" className="w-full">
                  <TabsList>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="commits-graph">
                      Commits Graph
                    </TabsTrigger>
                  </TabsList>
                  <ProfilerTimelineEventTracks>
                    {({ tracks, setTracks }) => (
                      <TabsContent value="timeline">
                        <ProfilerTimeline
                          tracks={tracks}
                          onEventTracksUpdate={setTracks}
                          replayer={replayer}
                        />
                      </TabsContent>
                    )}
                  </ProfilerTimelineEventTracks>
                  <TabsContent value="commits-graph">
                    <ProfilerGraph />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </SessionRecorder>
    </ProfilerProvider>
  );
}

const TestComponent = memo(function TestComponent() {
  const [text, setText] = React.useState("");
  const deferredText = React.useDeferredValue(text);

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Input and List</h2>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);

          performance.mark("Start Keyup");
          // const now = Date.now();
          // while (Date.now() - now < 100) {}
          performance.mark("End Keyup");
          performance.measure("Keyup", "Start Keyup", "End Keyup");
        }}
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Type to trigger re-rendering..."
      />
      <List text={deferredText} />
    </div>
  );
});

function Foo() {
  const [count, setCount] = React.useState(0);
  if (count === 1) {
    simulateDelay(40);
  }
  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Increment count</button>
    </div>
  );
}

const List = React.memo(function List({ text }: { text: string }) {
  simulateDelay(10);
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    items.push(<SlowItem key={i} text={text} />);
  }
  return (
    <div>
      <ul className="space-y-2 my-4">{items}</ul>
      {text.includes("y") && <SlowComponent />}
    </div>
  );
});

function SlowComponent() {
  simulateDelay(120);
  return <div>Slow Component</div>;
}

function SlowItem({ text }: { text: string }) {
  simulateDelay(5);

  return (
    <li className="p-2">
      <span>Text: {text}</span>
    </li>
  );
}

function ProfilerTimeline({
  tracks,
  onEventTracksUpdate,
  replayer,
}: {
  tracks: EventTrack[];
  onEventTracksUpdate: React.Dispatch<React.SetStateAction<EventTrack[]>>;
  replayer: any;
}) {
  const [isProfilingStarted, setIsProfilingStarted] = useState(false);
  const profilerEventTracksRef = React.useRef<EventTrack[]>(tracks);

  // Reference to store the baseline timestamp when profiling starts
  const baselineTimestampRef = React.useRef<number | null>(null);

  // Effect to initialize the baseline timestamp when profiling starts
  useEffect(() => {
    if (isProfilingStarted && baselineTimestampRef.current === null) {
      // Set the baseline timestamp when profiling starts
      baselineTimestampRef.current = performance.now();

      // Clear previous events when starting a new profiling session
      onEventTracksUpdate([
        {
          id: "network-resource",
          label: "Network Requests",
          color: "rgb(64, 192, 87)",
          events: [],
        },
        {
          id: "user-input",
          label: "User Inputs",
          color: "#ed64a6",
          events: [],
        },
        {
          id: "render",
          label: "Renders",
          color: "#4299e1",
          events: [],
        },
      ]);

      profilerEventTracksRef.current = [
        {
          id: "network-resource",
          label: "Network Requests",
          color: "rgb(64, 192, 87)",
          events: [],
        },
        {
          id: "user-input",
          label: "User Inputs",
          color: "#ed64a6",
          events: [],
        },
        {
          id: "render",
          label: "Renders",
          color: "#4299e1",
          events: [],
        },
      ];
    }

    // Reset the baseline when profiling stops
    if (!isProfilingStarted) {
      baselineTimestampRef.current = null;
    }
  }, [isProfilingStarted, onEventTracksUpdate]);

  // Calculate relative time from the baseline
  const getRelativeTime = useCallback((absoluteTime: number): number => {
    if (baselineTimestampRef.current === null) return absoluteTime;
    return absoluteTime - baselineTimestampRef.current;
  }, []);

  useEffect(() => {
    scan({
      enabled: isProfilingStarted,
      disableOutline: true,
      showToolbar: false,
      onRender(fiber, renders) {
        const render = renders[0];

        if (!fiber.actualStartTime || !render.time) {
          return;
        }

        const startTime = getRelativeTime(fiber.actualStartTime);

        if (startTime < 0) return;

        const event = {
          id: `${render.componentName}-${startTime}`,
          label: render.componentName ?? "Unknown",
          startTime: startTime,
          endTime: startTime + render.time,
          duration: render.time,
          eventTrackId: "render",
        };

        const renderTrackIdx = profilerEventTracksRef.current.findIndex(
          (track) => track.id === "render"
        );
        profilerEventTracksRef.current[renderTrackIdx].events = [
          ...profilerEventTracksRef.current[renderTrackIdx].events,
          event,
        ];
      },
      animationSpeed: "off",
    });
  }, [getRelativeTime, isProfilingStarted]);

  useEffect(
    function observeEventTiming() {
      if (!isProfilingStarted) {
        return;
      }

      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry, idx) => {
          if (!["input", "click"].includes(entry.name)) {
            return;
          }

          // Adjust the times relative to our baseline
          const relativeStartTime = getRelativeTime(entry.startTime);

          if (relativeStartTime < 0) return;

          const event = {
            id: `${entry.name}-${idx}`,
            label: entry.name,
            startTime: relativeStartTime,
            endTime: relativeStartTime + entry.duration,
            duration: entry.duration,
            eventTrackId: "user-input",
          };

          const userInputTrackIdx = profilerEventTracksRef.current.findIndex(
            (track) => track.id === "user-input"
          );
          profilerEventTracksRef.current[userInputTrackIdx].events = [
            ...profilerEventTracksRef.current[userInputTrackIdx].events,
            event,
          ];
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
    [getRelativeTime, isProfilingStarted]
  );

  useEffect(
    function observeResourceTiming() {
      if (!isProfilingStarted) {
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
            startTime: relativeFetchStart,
            endTime: relativeResponseEnd,
            duration: relativeResponseEnd - relativeFetchStart,
            eventTrackId: "network-resource",
          };

          const networkTrackIdx = profilerEventTracksRef.current.findIndex(
            (track) => track.id === "network-resource"
          );
          profilerEventTracksRef.current[networkTrackIdx].events = [
            ...profilerEventTracksRef.current[networkTrackIdx].events,
            event,
          ];
        });
      });

      // Register the observer for events
      observer.observe({
        type: "resource",
        buffered: true,
      });

      return () => observer.disconnect();
    },
    [getRelativeTime, isProfilingStarted]
  );

  return (
    <div className="flex flex-col space-y-4 w-full">
      <button
        onClick={() => {
          const newState = !isProfilingStarted;
          if (!newState) {
            onEventTracksUpdate([...profilerEventTracksRef.current]);
            replayer.stopRecording();

            // play recording. put it into timeout callback to make sure
            // the needed state for playing recording are all set.
            // flushSync is not working.
            setTimeout(() => {
              replayer.playRecording();
            }, 0);
          } else {
            // Clear the events when starting a new profiling session
            onEventTracksUpdate([
              {
                id: "network-resource",
                label: "Network Requests",
                color: "rgb(64, 192, 87)",
                events: [],
              },
              {
                id: "user-input",
                label: "User Inputs",
                color: "#ed64a6",
                events: [],
              },
              {
                id: "render",
                label: "Renders",
                color: "#4299e1",
                events: [],
              },
            ]);
            profilerEventTracksRef.current = [
              {
                id: "network-resource",
                label: "Network Requests",
                color: "rgb(64, 192, 87)",
                events: [],
              },
              {
                id: "user-input",
                label: "User Inputs",
                color: "#ed64a6",
                events: [],
              },
              {
                id: "render",
                label: "Renders",
                color: "#4299e1",
                events: [],
              },
            ];
            replayer.startRecording();
          }

          setIsProfilingStarted(newState);
        }}
      >
        {isProfilingStarted ? "Stop Profiling" : "Start Profiling"}
      </button>
      {!isProfilingStarted && tracks.length > 0 && (
        <Timeline
          tracks={tracks}
          onEventClick={(event) => {
            console.log("Clicked event:", event);
          }}
        />
      )}
    </div>
  );
}

function ProfilerTimelineEventTracks({
  children,
}: {
  children: (props: {
    tracks: EventTrack[];
    setTracks: React.Dispatch<React.SetStateAction<EventTrack[]>>;
  }) => React.ReactNode;
}) {
  const [tracks, setTracks] = React.useState<EventTrack[]>([
    {
      id: "network-resource",
      label: "Network Requests",
      color: "rgb(64, 192, 87)",
      events: [],
    },
    {
      id: "user-input",
      label: "User Inputs",
      color: "#ed64a6",
      events: [],
    },
    {
      id: "render",
      label: "Renders",
      color: "#4299e1",
      events: [],
    },
  ]);
  return children({ tracks, setTracks });
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
