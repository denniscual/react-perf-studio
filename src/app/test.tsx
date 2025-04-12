"use client";
import React, { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { simulateDelay } from "./util";
import {
  Profiler,
  ProfilerControls,
  profilerDataStore,
  ProfilerGraph,
  ProfilerProvider,
  useProfilerProvider,
} from "./profiler";
import Timeline from "./timeline";

export default function TestList() {
  return (
    <ProfilerProvider>
      <div className="space-y-4 p-4">
        {/* Horizontal Layout */}
        <div className="flex flex-row space-x-6">
          {/* Left Pane - List Component */}
          <div className="w-3/10 border border-gray-200 rounded-md p-4">
            <Profiler id="TestComponent">
              <TestComponent />
            </Profiler>
          </div>
          {/* Right Pane - Profiler View */}
          <div className="w-7/10 border border-gray-200 rounded-md p-4">
            <h2 className="text-lg font-bold mb-6">Profiler</h2>
            <div className="space-y-5">
              <ProfilerControls />
              <ProfilerTimeline />
              <ProfilerGraph />
            </div>
          </div>
        </div>
      </div>
    </ProfilerProvider>
  );
}

function TestComponent() {
  const [text, setText] = React.useState("");
  const deferredText = React.useDeferredValue(text);

  simulateDelay(10);

  useLayoutEffect(() => {
    simulateDelay(25);
  }, [text]);

  return (
    <div>
      <Profiler id="Foo">
        <Foo />
      </Profiler>
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
      <Profiler id="List">
        <List text={deferredText} />
      </Profiler>
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
  // Use the reusable delay function with a longer delay
  simulateDelay(120);
  return <div>Slow Component</div>;
}

function SlowItem({ text }: { text: string }) {
  // Use the reusable delay function with default delay
  simulateDelay(5);

  return (
    <li className="p-2">
      <span>Text: {text}</span>
    </li>
  );
}

// TODO:
// - create RendersTimeline using our timeline codes. Check the React Profiler Timeline
// for reference.
// - create UserEventsTimeline.
// - add replayer/rrweb
// - profiling doesn't work in prod (build and then run pnpm start).
function ProfilerTimeline() {
  const data = useSyncExternalStore(
    profilerDataStore.subscribe,
    profilerDataStore.getSnapshot,
    profilerDataStore.getSnapshot
  );

  const [inputEvents, setInputEvents] = React.useState<any>([]);
  const { isProfilingStarted } = useProfilerProvider();

  const renderEvents: any[] = [];
  data.renders.forEach((render) => {
    // if (render.actualDuration === 0) return;

    const event = {
      type: render.id,
      category: "Render",
      y: 3,
      start: render.startTime,
      end: render.startTime + render.actualDuration,
      color: "#9c27b0",
    };
    renderEvents.push(event);
  });

  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!["input", "click"].includes(entry.name)) {
          return;
        }

        const event = {
          type: entry.name,
          category: "Input",
          y: 2,
          start: entry.startTime,
          end: entry.startTime + entry.duration,
          color: "#4dabf5",
        };
        setInputEvents((prev) => [...prev, event]);
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
  }, []);

  if (isProfilingStarted || data.profiles.length === 0) return null;

  console.log({ inputEvents });

  return (
    <div>
      <Timeline renders={renderEvents} inputs={inputEvents} />{" "}
    </div>
  );
}

const Foo = React.memo(function Foo() {
  const [toggleFoo, setToggleFoo] = React.useState(false);
  simulateDelay(200);

  return (
    <div>
      <button
        onClick={() => {
          setToggleFoo(!toggleFoo);
        }}
      >
        Update Foo Slow Component
      </button>
    </div>
  );
});
