"use client";
import React, { useState, useEffect, useRef } from "react";
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
  xAxis: any;
  yAxis: any;
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
  const { cx, payload, xAxis } = props;
  const eventHeight = 25;
  const verticalSpacing = 40; // Space between different event types

  // Different colors based on event type and theme
  const color = payload.type === "render" ? "#4299e1" : "#ed64a6";
  const opacity = 0.8;

  // Adjusted to position events in the center of the chart vertically
  let yOffset = 0;
  if (payload.type === "render") {
    yOffset = 120; // Centered render events
  } else {
    yOffset = 120 + verticalSpacing; // Input events below render events
  }

  return (
    <Rectangle
      x={cx}
      y={yOffset - eventHeight / 2} // Use fixed positions instead of cy
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

  // State for tracking if Command key is pressed
  const [isCommandPressed, setIsCommandPressed] = useState(false);

  // Track Command key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setIsCommandPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setIsCommandPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", () => setIsCommandPressed(false));

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", () => setIsCommandPressed(false));
    };
  }, []);

  // State for zoom functionality - removed refArea properties as we're no longer using area selection
  const [zoomState, setZoomState] = useState({
    left: minTime,
    right: maxTime,
  });

  // Reference to maintain the chart's current view domain
  const chartRef = useRef<any>(null);

  // Refs for mouse interaction
  const isDraggingRef = useRef(false);
  const lastMousePositionRef = useRef(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Prevent text selection during drag operations
  useEffect(() => {
    const preventSelection = (e: Event) => {
      if (isDraggingRef.current) {
        e.preventDefault();
      }
    };

    document.addEventListener("selectstart", preventSelection);
    return () => {
      document.removeEventListener("selectstart", preventSelection);
    };
  }, []);

  // Generate custom ticks at intervals appropriate for the current zoom level
  const generateCustomTicks = () => {
    const ticks = [];
    const range = zoomState.right - zoomState.left;
    // Adapt tick interval based on zoom level
    const tickInterval = range <= 200 ? 10 : range <= 500 ? 25 : 50;
    const numTicks = Math.ceil(range / tickInterval) + 1;

    for (let i = 0; i < numTicks; i++) {
      const tick = zoomState.left + i * tickInterval;
      if (tick <= zoomState.right) {
        ticks.push(tick);
      }
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

  // Reset zoom
  const handleZoomOut = () => {
    setZoomState({
      left: minTime,
      right: maxTime,
    });
  };

  // Mouse event handlers for zoom and pan
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only track mouse position for potential panning
    isDraggingRef.current = true;
    lastMousePositionRef.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    // Only perform panning when Command key is pressed
    if (isCommandPressed) {
      const chartRect = chartContainerRef.current?.getBoundingClientRect();
      if (!chartRect) return;

      const timeRange = zoomState.right - zoomState.left;

      // Calculate how much the mouse has moved in time units
      const pixelDelta = e.clientX - lastMousePositionRef.current;
      const timeDelta = (pixelDelta / chartRect.width) * timeRange;

      // Update the time window
      const newLeft = Math.max(minTime, zoomState.left - timeDelta);
      const newRight = Math.min(maxTime, zoomState.right - timeDelta);

      // If we hit the boundary, adjust both ends to maintain the range
      if (newLeft === minTime) {
        setZoomState({
          ...zoomState,
          left: minTime,
          right: minTime + timeRange,
        });
      } else if (newRight === maxTime) {
        setZoomState({
          ...zoomState,
          left: maxTime - timeRange,
          right: maxTime,
        });
      } else {
        setZoomState({
          ...zoomState,
          left: newLeft,
          right: newRight,
        });
      }

      lastMousePositionRef.current = e.clientX;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Handle mouse leave to cleanup any ongoing operations
  const handleMouseLeave = () => {
    isDraggingRef.current = false;
  };

  // Mouse wheel zoom functionality
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Prevent default scrolling behavior only within the chart area
    e.preventDefault();
    e.stopPropagation();

    // Don't zoom if Command key is pressed (reserved for panning)
    if (isCommandPressed) return;

    // Get current visible range
    const range = zoomState.right - zoomState.left;

    // Calculate zoom factor based on wheel delta
    // Negative delta means zoom in, positive means zoom out
    const zoomFactor = e.deltaY < 0 ? 0.8 : 1.2;

    // Calculate the point on the timeline where the mouse is
    const chartRect = chartContainerRef.current?.getBoundingClientRect();
    if (!chartRect) return;

    // Get the relative mouse position within the chart container
    const mouseX = (e.clientX - chartRect.left) / chartRect.width;

    // Calculate the time point under the mouse
    const mouseTimePosition = zoomState.left + mouseX * range;

    // Calculate new range and boundaries, keeping the mouse position fixed
    const newRange = Math.min(maxTime - minTime, range * zoomFactor);
    const newLeft = Math.max(minTime, mouseTimePosition - mouseX * newRange);
    const newRight = Math.min(maxTime, newLeft + newRange);

    // Adjust left if right exceeds maximum
    const adjustedLeft = newRight === maxTime ? newRight - newRange : newLeft;

    // Update zoom state
    setZoomState({
      ...zoomState,
      left: adjustedLeft,
      right: newRight,
    });
  };

  // Dark mode classes
  const darkModeClasses = darkMode ? "dark" : "";

  return (
    <div className={`flex flex-col h-[400px] ${darkModeClasses}`}>
      <div className="flex flex-col h-full dark:bg-gray-900 bg-gray-100">
        {/* Controls */}
        <div className="flex justify-between p-2 dark:bg-gray-800 dark:border-gray-700 bg-white border-b">
          {/* Legend */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <div className="w-4 h-4 mr-2 bg-blue-500 rounded"></div>
              <span className="dark:text-white">Render Events</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 mr-2 bg-pink-500 rounded"></div>
              <span className="dark:text-white">Input Events</span>
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Reset Zoom
            </button>

            <span className="text-sm dark:text-gray-300 hidden sm:inline">
              {isCommandPressed
                ? "Command key is pressed (Pan mode)"
                : "Use mouse wheel to zoom | ⌘ + mouse drag to pan"}
            </span>
          </div>
        </div>

        {/* Main Timeline Chart with Horizontal Scroll */}
        <div
          className="flex-1 p-4 overflow-hidden"
          ref={chartContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        >
          {/* Fixed width container based on the calculated width */}
          <div style={{ minWidth: "100%" }}>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart
                ref={chartRef}
                margin={{
                  top: 30,
                  right: 20,
                  bottom: 60,
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
                  domain={[zoomState.left, zoomState.right]}
                  ticks={customTicks}
                  allowDataOverflow
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
                  domain={[0, 4]}
                  tickCount={2}
                  hide={true}
                  padding={{ top: 20, bottom: 20 }}
                  stroke={darkMode ? "#e2e8f0" : "#4a5568"}
                />
                <Tooltip content={<CustomTooltip />} />
                <Scatter data={chartData} shape={<CustomShape />} />

                {/* No reference area for zoom selection since we removed that feature */}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineProfiler;
