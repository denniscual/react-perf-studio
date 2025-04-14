"use client";
import React, { useState, useEffect } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
} from "recharts";

// Type definitions
interface ProfilerEvent {
  id: string;
  type: "render" | "input";
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  depth: number;
}

interface ChartData extends ProfilerEvent {
  x: number;
  y: number;
  z: number;
  baseTime: number;
}

interface CustomShapeProps {
  cx: number;
  cy: number;
  height: number;
  width?: number;
  fill?: string;
  payload: ChartData;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartData }>;
}

// Custom tooltip component
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const baseTime = data.baseTime || 0;

    return (
      <div className="p-2 border rounded-md shadow-md dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300">
        <p className="font-semibold dark:text-white">{data.name}</p>
        <p className="text-sm dark:text-gray-300 text-gray-600">
          Type: {data.type}
        </p>
        <p className="text-sm dark:text-gray-300 text-gray-600">
          Duration: {data.duration.toFixed(2)}ms
        </p>
        <p className="text-sm dark:text-gray-300 text-gray-600">
          Start: {((data.startTime - baseTime) / 1).toFixed(1)}ms
        </p>
        <p className="text-sm dark:text-gray-300 text-gray-600">
          End: {((data.endTime - baseTime) / 1).toFixed(1)}ms
        </p>
      </div>
    );
  }
  return null;
};

// Custom shape for the events in the timeline
const CustomShape: React.FC<CustomShapeProps> = (props) => {
  const { cx, cy, payload, xAxis } = props;
  const eventHeight = 25;
  // Different colors based on event type and theme
  const color = payload.type === "render" ? "#4299e1" : "#ed64a6";
  const opacity = 0.8;
  return (
    <Rectangle
      x={cx}
      y={cy - eventHeight / 2}
      width={xAxis.scale(payload.endTime) - xAxis.scale(payload.startTime)}
      height={eventHeight}
      fill={color}
      fillOpacity={opacity}
      className="cursor-pointer hover:fill-opacity-100"
    />
  );
};

// Main Timeline Profiler component
const TimelineProfiler: React.FC<{
  events: ProfilerEvent[];
}> = ({ events }) => {
  // Set time window
  const times = events.map((d) => [d.startTime, d.endTime]).flat();
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const filter = "all";
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Generate custom ticks at 50ms intervals
  const generateCustomTicks = () => {
    const ticks = [];
    const range = maxTime - minTime;
    const tickInterval = 50; // 50ms intervals
    const numTicks = Math.ceil(range / tickInterval) + 1;

    for (let i = 0; i < numTicks; i++) {
      ticks.push(minTime + i * tickInterval);
    }

    return ticks;
  };

  const customTicks = generateCustomTicks();

  // Check for system dark mode preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setDarkMode(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Filter events based on selection
  const filteredEvents = events.filter((event) => {
    if (filter === "all") return true;
    return event.type === filter;
  });

  // Prepare data for the chart
  const chartData: ChartData[] = filteredEvents.map((event) => ({
    ...event,
    x: event.startTime,
    y: event.depth,
    z: event.endTime - event.startTime,
    baseTime: minTime, // Add baseTime to each data point for tooltip access
  }));

  // Dark mode classes
  const darkModeClasses = darkMode ? "dark" : "";

  return (
    <div className={`flex flex-col h-[500px] ${darkModeClasses}`}>
      <div className="flex flex-col h-full dark:bg-gray-900 bg-gray-100">
        {/* Legend */}
        <div className="flex justify-center space-x-8 p-2 dark:bg-gray-800 dark:border-gray-700 bg-white border-b">
          <div className="flex items-center">
            <div className="w-4 h-4 mr-2 bg-blue-500 rounded"></div>
            <span className="dark:text-white">Render Events</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 mr-2 bg-pink-500 rounded"></div>
            <span className="dark:text-white">Input Events</span>
          </div>
        </div>
        {/* Main Timeline Chart with Horizontal Scroll */}
        <div className="flex-1 p-4 overflow-x-auto">
          {/* Fixed width container based on the calculated width */}
          <div style={{ minWidth: "100%" }}>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart
                margin={{
                  top: 50,
                  right: 20,
                  bottom: 20,
                  left: 100,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={darkMode ? "#4a5568" : "#e2e8f0"}
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Time"
                  domain={[minTime, maxTime]}
                  ticks={customTicks}
                  tickFormatter={(tick) => {
                    // Show relative time in milliseconds from start
                    return `${((tick - minTime) / 1).toFixed(0)}ms`;
                  }}
                  label={{
                    value: "Time (ms)",
                    position: "bottom",
                    offset: 10,
                    fill: darkMode ? "#e2e8f0" : "#4a5568",
                  }}
                  stroke={darkMode ? "#e2e8f0" : "#4a5568"}
                  scale="linear"
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Track"
                  domain={[0, 1]}
                  tickCount={2}
                  hide={true} // Hide the Y-axis labels
                  padding={{ top: 50, bottom: 50 }}
                  stroke={darkMode ? "#e2e8f0" : "#4a5568"}
                />
                <Tooltip content={<CustomTooltip />} />
                <Scatter data={chartData} shape={<CustomShape />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineProfiler;
