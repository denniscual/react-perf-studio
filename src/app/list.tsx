"use client";
import React from "react";

export default function List() {
  const [text, setText] = React.useState("");
  const deferredText = React.useDeferredValue(text);
  return (
    <>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <WrapperProfiler id="list">
        <SlowList text={deferredText} />
      </WrapperProfiler>
    </>
  );
}

const SlowList = React.memo(function SlowList({ text }: { text: string }) {
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    items.push(
      <WrapperProfiler id="list-item" key={i}>
        <SlowItem text={text} />
      </WrapperProfiler>,
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
      onRender={(
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      ) => {
        console.log({
          id,
          phase,
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
        });
      }}
    />
  );
}
