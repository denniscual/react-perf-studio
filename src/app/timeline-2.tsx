"use client";
import React, { useState, useEffect, useRef, WheelEventHandler } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

// Type definitions
interface ProfilerEvent {
  id: string;
  type: "render" | "input" | "resource";
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

// Define proper zoom state interface with correct types
interface ZoomState {
  left: number;
  right: number;
  refAreaLeft: number | null;
  refAreaRight: number | null;
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
  const verticalSpacing = 40;

  // Different colors based on event type and theme
  let color;
  switch (payload.type) {
    case "render":
      color = "#4299e1"; // Blue
      break;
    case "input":
      color = "#ed64a6"; // Pink
      break;
    case "resource":
      color = "#48bb78"; // Green
      break;
    default:
      color = "#a0aec0"; // Gray fallback
  }

  const opacity = 0.8;

  // Adjusted to position events higher on the chart
  let yOffset = 0;
  if (payload.type === "render") {
    yOffset = 80; // Moved up from 120
  } else if (payload.type === "input") {
    yOffset = 80 + verticalSpacing; // Input events below render events
  } else if (payload.type === "resource") {
    yOffset = 80 + verticalSpacing * 2; // Resource events at the bottom
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

  // State for zoom functionality with correctly typed values
  const [zoomState, setZoomState] = useState<ZoomState>({
    left: minTime,
    right: maxTime,
    refAreaLeft: null,
    refAreaRight: null,
  });

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
      refAreaLeft: null,
      refAreaRight: null,
    });
  };

  // Mouse event handlers for zoom (area selection) and pan (Command key)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    lastMousePositionRef.current = e.clientX;

    const chartRect = chartContainerRef.current?.getBoundingClientRect();
    if (!chartRect) return;

    const mouseX = (e.clientX - chartRect.left) / chartRect.width;
    const timeRange = zoomState.right - zoomState.left;

    if (isCommandPressed) {
      // Start panning if Command key is pressed
      // No need to set refArea for panning
    } else {
      // Start zoom area selection if Command key is not pressed
      const timePosition = zoomState.left + mouseX * timeRange;
      setZoomState({
        ...zoomState,
        refAreaLeft: timePosition,
        refAreaRight: null,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const chartRect = chartContainerRef.current?.getBoundingClientRect();
    if (!chartRect) return;

    const mouseX = (e.clientX - chartRect.left) / chartRect.width;
    const timeRange = zoomState.right - zoomState.left;

    if (isCommandPressed) {
      // Handle panning when Command key is pressed
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
          refAreaLeft: null,
          refAreaRight: null,
        });
      } else if (newRight === maxTime) {
        setZoomState({
          ...zoomState,
          left: maxTime - timeRange,
          right: maxTime,
          refAreaLeft: null,
          refAreaRight: null,
        });
      } else {
        setZoomState({
          ...zoomState,
          left: newLeft,
          right: newRight,
          refAreaLeft: null,
          refAreaRight: null,
        });
      }

      lastMousePositionRef.current = e.clientX;
    } else if (zoomState.refAreaLeft !== null) {
      // Handle zoom area selection when Command key is not pressed
      const timePosition = zoomState.left + mouseX * timeRange;
      setZoomState({
        ...zoomState,
        refAreaRight: timePosition,
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // If we have a valid zoom area selection, zoom to that area
    if (
      !isCommandPressed &&
      zoomState.refAreaLeft !== null &&
      zoomState.refAreaRight !== null
    ) {
      handleZoom();
    }
  };

  // Complete the zoom operation based on the selected area
  const handleZoom = () => {
    let { refAreaLeft, refAreaRight } = zoomState;

    if (
      refAreaLeft === null ||
      refAreaRight === null ||
      refAreaLeft === refAreaRight
    ) {
      setZoomState({
        ...zoomState,
        refAreaLeft: null,
        refAreaRight: null,
      });
      return;
    }

    // Ensure left is less than right
    if (refAreaLeft > refAreaRight) {
      [refAreaLeft, refAreaRight] = [refAreaRight, refAreaLeft];
    }

    // Add a minimum zoom width to prevent zooming in too far
    const minZoomWidth = 10; // minimum 10ms
    if (Math.abs(refAreaRight - refAreaLeft) < minZoomWidth) {
      const midPoint = (refAreaLeft + refAreaRight) / 2;
      refAreaLeft = midPoint - minZoomWidth / 2;
      refAreaRight = midPoint + minZoomWidth / 2;
    }

    // Update the zoom state with new boundaries
    setZoomState({
      ...zoomState,
      left: refAreaLeft,
      right: refAreaRight,
      refAreaLeft: null,
      refAreaRight: null,
    });
  };

  // Handle mouse leave to cleanup any ongoing operations
  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setZoomState({
      ...zoomState,
      refAreaLeft: null,
      refAreaRight: null,
    });
  };

  useEffect(() => {
    // Mouse wheel zoom functionality with improved scroll prevention
    const handleWheel: WheelEventHandler<HTMLDivElement> = (e) => {
      // IMPORTANT: We need to prevent default here in the React handler
      // This works together with the DOM event listener for full coverage
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
      setZoomState((prev) => ({
        ...prev,
        left: adjustedLeft,
        right: newRight,
      }));

      // Return false for extra measure (helps in some browsers)
      return false;
    };

    const chartContainer = chartContainerRef.current;

    if (!chartContainer) return;

    chartContainer.addEventListener(
      "wheel",
      // @ts-expect-error event type is incompatible to react wheel event type.
      handleWheel,
      {
        passive: false,
      }
    );

    return () => {
      chartContainer.removeEventListener(
        "wheel",
        // @ts-expect-error event type is incompatible to react wheel event type.
        handleWheel
      );
    };
  }, [isCommandPressed, maxTime, minTime, zoomState.left, zoomState.right]);

  // Dark mode classes
  const darkModeClasses = darkMode ? "dark" : "";

  return (
    <div className={`flex flex-col h-[400px] ${darkModeClasses}`}>
      <div className="flex flex-col h-full dark:bg-gray-900 bg-gray-100">
        {/* Controls */}
        <div className="flex justify-between p-2 dark:bg-gray-800 dark:border-gray-700 bg-white border-b">
          {/* Legend */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <div className="w-4 h-4 mr-2 bg-blue-500 rounded"></div>
              <span className="dark:text-white">Render Events</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 mr-2 bg-pink-500 rounded"></div>
              <span className="dark:text-white">Input Events</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 mr-2 bg-green-500 rounded"></div>
              <span className="dark:text-white">Resource Events</span>
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
                : "Drag to select area | ⌘ + drag to pan"}
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
          style={{
            touchAction: "none", // Disable touch scrolling behaviors
            msOverflowStyle: "none", // Hide scrollbar in IE/Edge
            scrollbarWidth: "none", // Hide scrollbar in Firefox
          }}
        >
          {/* CSS to hide webkit scrollbars */}
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {/* Fixed width container based on the calculated width */}
          <div style={{ minWidth: "100%" }}>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart
                ref={chartRef}
                margin={{
                  top: 20,
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
                  domain={[0, 4]} // Adjusted for better vertical spacing
                  tickCount={2}
                  hide={true}
                  padding={{ top: 40, bottom: 40 }}
                  stroke={darkMode ? "#e2e8f0" : "#4a5568"}
                />
                <Tooltip content={<CustomTooltip />} />
                <Scatter
                  data={chartData}
                  shape={
                    // @ts-expect-error prop are internally by Scatter.
                    <CustomShape />
                  }
                />

                {/* Reference area for zoom selection - using proper null checks */}
                {zoomState.refAreaLeft !== null &&
                zoomState.refAreaRight !== null ? (
                  <ReferenceArea
                    x1={zoomState.refAreaLeft}
                    x2={zoomState.refAreaRight}
                    strokeOpacity={0.3}
                    fill={darkMode ? "#4a5568" : "#e2e8f0"}
                    fillOpacity={0.3}
                  />
                ) : null}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineProfiler;
