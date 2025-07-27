"use client";
import React, { useCallback, useEffect } from "react";
import SessionRecorder from "./replayer";
import { scan } from "react-scan";
import { Timeline } from "@/components/timeline";
import { EventTrack, TimelineEvent } from "@/components/timeline/renderer";
import { TestComponent } from "@/components/test-component";

export default function TestList() {
  return (
    <SessionRecorder>
      {(replayer) => (
        <div className="space-y-4 p-4">
          <div className="space-y-6">
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
              <ProfilerTimelineEventTracks>
                {({ eventTracks, setEventTracks }) => (
                  <ProfilerTimeline
                    eventTracks={eventTracks}
                    setEventTracks={setEventTracks}
                    replayer={replayer}
                  />
                )}
              </ProfilerTimelineEventTracks>
            </div>
          </div>
        </div>
      )}
    </SessionRecorder>
  );
}

function ProfilerTimeline({
  eventTracks,
  setEventTracks,
  replayer,
}: {
  eventTracks: Map<string, EventTrack>;
  setEventTracks: React.Dispatch<React.SetStateAction<Map<string, EventTrack>>>;
  replayer: any;
}) {
  const [profilingSessionStatus, setProfilingSessionStatus] = React.useState<
    "init" | "pending" | "stop"
  >("init");
  // Reference to store the baseline timestamp when profiling starts
  const baselineTimestampRef = React.useRef<number | null>(null);
  // Create a ref to store the event eventTracks to avoid infinite re-renders caused by react-scan.
  const eventTracksRef = React.useRef<Map<string, EventTrack>>(eventTracks);

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

  const addTimelineEvent = React.useCallback((event: TimelineEvent) => {
    const eventTracks = eventTracksRef.current;
    const eventTrack = eventTracks.get(event.eventTrackId);

    if (!eventTrack) return;

    eventTracks.set(event.eventTrackId, {
      ...eventTrack,
      events: [...eventTrack.events, event],
    });

    eventTracksRef.current = new Map(eventTracks);
  }, []);

  useEffect(() => {
    scan({
      enabled: profilingSessionStatus === "pending",
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
          id: `${render.componentName}-${roundTime(startTime)}`,
          label: render.componentName ?? "Unknown",
          startTime: roundTime(startTime),
          endTime: roundTime(startTime + render.time),
          duration: roundTime(render.time),
          eventTrackId: "render",
        };

        addTimelineEvent(event);
      },
      animationSpeed: "off",
    });
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

  return (
    <div className="flex flex-col space-y-4 w-full">
      <button
        onClick={() => {
          const newStatus =
            profilingSessionStatus !== "pending" ? "pending" : "stop";

          if (newStatus === "stop") {
            // Update the event eventTracks
            setEventTracks(new Map(eventTracksRef.current));
            eventTracksRef.current = initEventTracks();

            replayer.stopRecording();
            // play recording. put it into timeout callback to make sure
            // the needed state for playing recording are all set.
            // flushSync is not working.
            setTimeout(() => {
              replayer.playRecording();
            }, 0);
          } else {
            // Clear the events when starting a new profiling session
            setEventTracks(initEventTracks());
            eventTracksRef.current = initEventTracks();
            // Start recording
            replayer.startRecording();
          }

          setProfilingSessionStatus(newStatus);
        }}
      >
        {profilingSessionStatus !== "pending"
          ? "Start Profiling"
          : "Stop Profiling"}
      </button>
      {profilingSessionStatus === "stop" && tracksArray.length > 0 && (
        <Timeline
          tracks={tracksArray}
          onEventClick={(event) => {
            replayer.jumpToTime(event.startTime);
          }}
          currentTime={replayer.currentTime}
          isPlaying={replayer.isPlaying}
        />
      )}
    </div>
  );
}

function ProfilerTimelineEventTracks({
  children,
}: {
  children: (props: {
    eventTracks: Map<string, EventTrack>;
    setEventTracks: React.Dispatch<
      React.SetStateAction<Map<string, EventTrack>>
    >;
  }) => React.ReactNode;
}) {
  const [eventTracks, setEventTracks] = React.useState<Map<string, EventTrack>>(
    () => {
      return initEventTracks();
    },
  );
  return children({ eventTracks, setEventTracks });
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
