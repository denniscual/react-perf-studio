"use client";
import React from "react";
import { simulateDelay } from "./util";
import { Profiler, ProfilerControls, ProfilerGraph } from "./profiler";

export default function TestList() {
  return (
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
          <h2 className="text-lg font-bold mb-4">Profiler Data</h2>
          <div className="space-y-4">
            <ProfilerControls />
            <ProfilerGraph />
          </div>
        </div>
      </div>
    </div>
  );
}

function TestComponent() {
  const [text, setText] = React.useState("");
  const deferredText = React.useDeferredValue(text);

  simulateDelay(3);

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Input and List</h2>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
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
