"use client";
import React, { useCallback, useEffect, useState } from "react";
import { simulateDelay } from "./util";
import {
  Profiler,
  ProfilerControls,
  ProfilerGraph,
  ProfilerProvider,
  useProfilerProvider,
} from "./profiler";
import Timeline from "./timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SessionRecorder from "./replayer";
import { scan } from "react-scan";

export default function TestList() {
  return (
    <ProfilerProvider>
      <SessionRecorder>
        {(replayer) => (
          <div className="space-y-4 p-4">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-6">Profiler</h2>
                <Profiler id="ProfilerControls">
                  <ProfilerControls replayer={replayer} />
                </Profiler>
              </div>
              <div className="w-1/2">
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
                  <ProfilerTimelineEvents>
                    {({ events, setEvents }) => (
                      <TabsContent value="timeline">
                        <ProfilerTimeline
                          events={events}
                          onTriggerEvent={setEvents}
                          replayer={replayer}
                        />
                      </TabsContent>
                    )}
                  </ProfilerTimelineEvents>
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

function TestComponent() {
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
}

const List = React.memo(function List({ text }: { text: string }) {
  simulateDelay(10);
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    items.push(
      <Profiler id={`SlowItem-${i}`} key={i}>
        <SlowItem text={text} />
      </Profiler>
    );
  }
  return (
    <div>
      <ul className="space-y-2 my-4">{items}</ul>
      {text.includes("y") && (
        <Profiler id="SlowComponent">
          <SlowComponent />
        </Profiler>
      )}
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

function ProfilerTimelineEvents({
  children,
}: {
  children: (props: any) => React.ReactNode;
}) {
  const [events, setEvents] = React.useState<any>([]);
  return children({ events, setEvents });
}

function ProfilerTimeline({
  events,
  onTriggerEvent,
  replayer,
}: {
  events: any;
  onTriggerEvent: any;
  replayer: any;
}) {
  const [isProfilingStarted, setIsProfilingStarted] = useState(false);
  const profilerEventsRef = React.useRef<any>([]);

  // Reference to store the baseline timestamp when profiling starts
  const baselineTimestampRef = React.useRef<number | null>(null);

  // Effect to initialize the baseline timestamp when profiling starts
  useEffect(() => {
    if (isProfilingStarted && baselineTimestampRef.current === null) {
      // Set the baseline timestamp when profiling starts
      baselineTimestampRef.current = performance.now();

      // Clear previous events when starting a new profiling session
      onTriggerEvent([]);

      profilerEventsRef.current = [];
    }

    // Reset the baseline when profiling stops
    if (!isProfilingStarted) {
      baselineTimestampRef.current = null;
    }
  }, [isProfilingStarted, onTriggerEvent]);

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
          type: "render",
          name: render.componentName,
          startTime: startTime,
          endTime: startTime + render.time,
          duration: render.time,
          depth: 1,
        };

        console.log({
          name: render.componentName,
          startTime: fiber.actualStartTime,
          relativeTime: startTime,
          baselineTimestamp: baselineTimestampRef.current,
          fiber,
        });

        profilerEventsRef.current.push(event);
      },
      animationSpeed: "off",
    });
  }, [getRelativeTime, isProfilingStarted, onTriggerEvent]);

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
            type: "input",
            name: entry.name,
            startTime: relativeStartTime,
            endTime: relativeStartTime + entry.duration,
            duration: entry.duration,
            depth: 1,
          };

          profilerEventsRef.current.push(event);
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
    [getRelativeTime, isProfilingStarted, onTriggerEvent]
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
            type: "resource",
            name: entry.name,
            startTime: relativeFetchStart,
            endTime: relativeResponseEnd,
            duration: relativeResponseEnd - relativeFetchStart,
            depth: 1,
          };

          profilerEventsRef.current.push(event);
        });
      });

      // Register the observer for events
      observer.observe({
        type: "resource",
        buffered: true,
      });

      return () => observer.disconnect();
    },
    [getRelativeTime, isProfilingStarted, onTriggerEvent]
  );

  return (
    <div className="flex flex-col space-y-4 w-full">
      <button
        onClick={() => {
          const newState = !isProfilingStarted;
          if (!newState) {
            onTriggerEvent(profilerEventsRef.current);
            replayer.stopRecording();

            // play recording. put it into timeout callback to make sure
            // the needed state for playing recording are all set.
            // flushSync is not working.
            setTimeout(() => {
              replayer.playRecording();
            }, 0);
          } else {
            // Clear the events when starting a new profiling session
            onTriggerEvent([]);
            profilerEventsRef.current = [];
            replayer.startRecording();
          }

          setIsProfilingStarted(newState);
        }}
      >
        {isProfilingStarted ? "Stop Profiling" : "Start Profiling"}
      </button>
      {!isProfilingStarted && events.length > 0 && (
        <Timeline events={events} replayer={replayer} />
      )}
    </div>
  );
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
