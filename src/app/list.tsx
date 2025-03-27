"use client";
import React from "react";

export default function TestList() {
  const [text, setText] = React.useState("");
  const deferredText = React.useDeferredValue(text);
  const [isProfilingStarted, setIsProfilingStarted] = React.useState(true);

  return (
    <div className="space-y-8">
      <button
        onClick={() => {
          setIsProfilingStarted(false);
          profilerDataStore.stopProfiling();
        }}
        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none"
      >
        Stop Profiling
      </button>
      <div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <WrapperProfiler id="List">
          <List text={deferredText} />
        </WrapperProfiler>
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
profilerDataStore.startProfiling();

if (typeof window !== "undefined") {
  // @ts-expect-error - Expose profilerDataStore to window for debugging
  window.__profilerDataStore = profilerDataStore;
}
