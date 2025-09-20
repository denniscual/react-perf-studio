"use client";
import React, { memo } from "react";
import { simulateDelay } from "@/app/util";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const TestComponent = memo(function TestComponent() {
  const [text, setText] = React.useState("");
  const deferredText = React.useDeferredValue(text);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="test-input" className="text-base font-medium">
            Performance Test Input
          </Label>
          <Badge variant="outline" className="text-xs">
            {text.length} chars
          </Badge>
        </div>
        <Input
          id="test-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);

            performance.mark("Start Keyup");
            performance.mark("End Keyup");
            performance.measure("Keyup", "Start Keyup", "End Keyup");
          }}
          placeholder="Type to trigger React renders and performance events..."
          className="text-base"
        />
        <p className="text-sm text-slate-500">
          Typing triggers component re-renders and performance measurements. Try
          typing &ldquo;y&rdquo; to render additional slow components.
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Rendered Components</Label>
          <Badge variant="secondary" className="text-xs">
            {deferredText !== text ? "Deferred" : "Live"}
          </Badge>
        </div>
        <List text={deferredText} />
      </div>
    </div>
  );
});

const List = React.memo(function List({ text }: { text: string }) {
  simulateDelay(10);
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    items.push(<SlowItem key={i} text={text} index={i} />);
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-2">{items}</div>
      {text.includes("y") && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Additional Slow Component Rendered
            </span>
          </div>
          <SlowComponent />
        </div>
      )}
    </div>
  );
});

function SlowComponent() {
  simulateDelay(120);
  return (
    <div className="text-sm text-amber-700 dark:text-amber-300">
      This component has a 120ms simulated delay to demonstrate slow rendering
      performance.
    </div>
  );
}

function SlowItem({ text, index }: { text: string; index: number }) {
  simulateDelay(5);

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium">
        {index + 1}
      </div>
      <div className="flex-1 text-sm">
        <span className="text-slate-600 dark:text-slate-400">Text: </span>
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {text || "Empty"}
        </span>
      </div>
    </div>
  );
}
