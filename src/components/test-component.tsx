"use client";
import React, { memo } from "react";
import { simulateDelay } from "@/app/util";

export const TestComponent = memo(function TestComponent() {
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
