"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  EventTrack,
  MAX_SCALE,
  MIN_SCALE,
  MouseState,
  TimelineEvent,
  TimelineRenderer,
  Viewport,
} from "./renderer";

// React component that uses TimelineRenderer
export const Timeline = ({
  tracks,
  onEventClick,
  currentTime = 0,
  isPlaying = false,
}: {
  tracks: EventTrack[];
  onEventClick: (event: TimelineEvent) => void;
  currentTime?: number;
  isPlaying?: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TimelineRenderer | null>(null);
  const [clickedEvent, setClickedEvent] = useState<TimelineEvent | null>(null);

  const [viewport, setViewport] = useState<Viewport>({
    offsetX: 0,
    scale: 0.1,
    startTime: 0,
    endTime: 800,
  });

  const [mouseState, setMouseState] = useState<MouseState>({
    isDragging: false,
    lastX: 0,
    isHovering: false,
    hoverEvent: null,
    hoverPosition: { x: 0, y: 0 },
  });

  // Initialize TimelineRenderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new TimelineRenderer(canvasRef.current);
    renderer.setOnEventClick((event) => {
      setClickedEvent(event);
      onEventClick(event);
    });

    rendererRef.current = renderer;
  }, [onEventClick]);

  useEffect(() => {
    const resizeCanvas = () => {
      if (!canvasRef.current || !containerRef.current || !rendererRef.current)
        return;

      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;

      rendererRef.current.drawTimeline();
    };

    resizeCanvas();

    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Update TimelineRenderer when state changes
  useEffect(() => {
    if (!rendererRef.current) return;

    rendererRef.current.setTracks(tracks);
    rendererRef.current.setViewport(viewport);
    rendererRef.current.setMouseState(mouseState);
    rendererRef.current.setCurrentTime(currentTime, isPlaying);
    rendererRef.current.drawTimeline();
  }, [tracks, viewport, mouseState, currentTime, isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;

      // Calculate time at cursor position
      const timeAtCursor = pixelToTime(cursorX, viewport);

      // Calculate new scale
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, viewport.scale * zoomFactor)
      );

      // Calculate new offset to keep the point under cursor at the same position
      const cursorOffsetX = cursorX;
      const newOffsetX =
        (timeAtCursor - viewport.startTime) * newScale - cursorOffsetX;

      setViewport((prev) => ({
        ...prev,
        scale: newScale,
        offsetX: Math.max(0, newOffsetX),
      }));
    };

    canvas.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [viewport]);

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseState((prev) => ({
      ...prev,
      isDragging: true,
      lastX: e.clientX,
    }));
  };

  // Handle mouse up to stop panning or trigger click
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!rendererRef.current || !canvasRef.current) return;

    const wasQuickClick =
      !mouseState.isDragging || Math.abs(e.clientX - mouseState.lastX) < 5;

    // Reset dragging state
    setMouseState((prev) => ({
      ...prev,
      isDragging: false,
    }));

    // Handle click if it wasn't a drag
    if (wasQuickClick) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      rendererRef.current.handleClick(x, y);
    }
  };

  // Handle mouse move for panning and tooltips
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !rendererRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Handle panning
    if (mouseState.isDragging) {
      const deltaX = e.clientX - mouseState.lastX;
      setViewport((prev) => ({
        ...prev,
        offsetX: Math.max(0, prev.offsetX - deltaX),
      }));
      setMouseState((prev) => ({
        ...prev,
        lastX: e.clientX,
      }));
      return;
    }

    // Find hovered event
    const event = rendererRef.current.findEventAtPosition(mouseX, mouseY);

    // Update hover state
    setMouseState((prev) => ({
      ...prev,
      isHovering: !!event,
      hoverEvent: event,
      hoverPosition: { x: mouseX, y: mouseY },
    }));
  };

  // Handle mouse leave to stop interactions
  const handleMouseLeave = () => {
    setMouseState((prev) => ({
      ...prev,
      isDragging: false,
      isHovering: false,
      hoverEvent: null,
    }));
  };

  const pixelToTime = (pixel: number, viewportState: Viewport): number => {
    const { scale, offsetX, startTime } = viewportState;
    return (pixel + offsetX) / scale + startTime;
  };

  // Reset view
  const resetView = () => {
    setViewport({
      offsetX: 0,
      scale: 1,
      startTime: 0,
      endTime: 800,
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-xl font-bold">Profiler Timeline</h2>
        <div className="flex space-x-2">
          <button
            className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
            onClick={resetView}
          >
            Reset View
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div
          ref={containerRef}
          className="flex-1 min-h-[600px] overflow-hidden relative"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        </div>

        {/* Event details panel */}
        <div className="w-64 p-4 bg-gray-800 border-l border-gray-700 overflow-auto">
          <h3 className="text-lg font-semibold mb-3">Event Details</h3>
          {clickedEvent ? (
            <div className="space-y-2">
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">
                  {clickedEvent.label}
                </div>
                <div className="text-sm text-gray-300 mt-1">
                  ID: {clickedEvent.id}
                </div>
                <div className="text-sm text-gray-300">
                  Start: {clickedEvent.startTime}ms
                </div>
                <div className="text-sm text-gray-300">
                  Duration: {clickedEvent.duration}ms
                </div>
                <div className="text-sm text-gray-300">
                  End: {clickedEvent.startTime + clickedEvent.duration}ms
                </div>
                <div className="mt-2 text-xs bg-gray-800 p-2 rounded">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(clickedEvent, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 italic">
              Click on an event to see details
            </div>
          )}
        </div>
      </div>

      <div className="p-2 border-t border-gray-700 bg-gray-800 text-xs text-gray-400">
        Use mouse wheel to zoom, drag to pan, click on events to view details
      </div>
    </div>
  );
};
