"use client";

import React, { useRef, useState, useEffect, WheelEventHandler } from "react";
import {
  TimelineRenderer,
  TimelineEvent,
  EventTrack,
  TRACK_HEIGHT,
  TRACK_PADDING,
  TIME_MARKERS_HEIGHT,
  LEGEND_HEIGHT,
  MIN_SCALE,
  MAX_SCALE,
} from "./renderer";

export function Timeline({ tracks }: { tracks: EventTrack[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TimelineRenderer | null>(null);

  // Viewport state
  const [viewport, setViewport] = useState({
    offsetX: 0,
    scale: 1,
    startTime: 0,
    endTime: 800,
  });

  // Mouse interaction state
  const [mouseState, setMouseState] = useState({
    isDragging: false,
    lastX: 0,
    isHovering: false,
    hoverEvent: null as TimelineEvent | null,
    hoverPosition: { x: 0, y: 0 },
  });

  // Initialize the renderer
  useEffect(() => {
    // Resize canvas to match container
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || !rendererRef.current) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      rendererRef.current.resizeCanvas();
    };

    rendererRef.current = new TimelineRenderer(canvasRef.current);
    resizeCanvas();

    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Update renderer with current state
  useEffect(() => {
    if (!rendererRef.current) return;

    rendererRef.current.setTracks(tracks);
    rendererRef.current.setViewport(viewport);
    rendererRef.current.setMouseState(mouseState);
    rendererRef.current.drawTimeline();
  }, [tracks, viewport, mouseState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel: WheelEventHandler<HTMLCanvasElement> = (
      e: React.WheelEvent
    ) => {
      e.preventDefault();
      e.stopPropagation();

      // Calculate cursor position in time
      const rect = canvas.getBoundingClientRect();
      if (!rect) return;

      const cursorX = e.clientX - rect.left;

      // Calculate new scale
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, viewport.scale * zoomFactor)
      );

      // Calculate new offset to keep the point under cursor at the same position
      const cursorOffsetX = cursorX;
      const timeAtCursor =
        viewport.startTime +
        (cursorOffsetX + viewport.offsetX) / viewport.scale;
      const newOffsetX =
        (timeAtCursor - viewport.startTime) * newScale - cursorOffsetX;

      setViewport((prev) => ({
        ...prev,
        scale: newScale,
        offsetX: Math.max(0, newOffsetX),
      }));
    };

    canvas.addEventListener(
      "wheel",
      // @ts-expect-error event type is incompatible to react wheel event type.
      handleWheel,
      {
        passive: false,
      }
    );

    return () => {
      canvas.removeEventListener(
        "wheel",
        // @ts-expect-error event type is incompatible to react wheel event type.
        handleWheel
      );
    };
  }, [viewport.offsetX, viewport.scale, viewport.startTime]);

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseState((prev) => ({
      ...prev,
      isDragging: true,
      lastX: e.clientX,
    }));
  };

  // Handle mouse move for panning and tooltips
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const renderer = rendererRef.current;

    if (!rect || !renderer) return;

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

    // Handle hover detection
    if (mouseY > TIME_MARKERS_HEIGHT + LEGEND_HEIGHT) {
      const trackIndex = Math.floor(
        (mouseY - TIME_MARKERS_HEIGHT - LEGEND_HEIGHT) /
          (TRACK_HEIGHT + TRACK_PADDING)
      );

      if (trackIndex >= 0 && trackIndex < tracks.length) {
        const track = tracks[trackIndex];

        // Find if hovering over an event
        const hoverEvent = track.events.find((event) => {
          const eventStartX = renderer.timeToPixel(event.startTime);
          const eventEndX = renderer.timeToPixel(
            event.startTime + event.duration
          );
          return mouseX >= eventStartX && mouseX <= eventEndX;
        });

        setMouseState((prev) => ({
          ...prev,
          isHovering: !!hoverEvent,
          hoverEvent: hoverEvent || null,
          hoverPosition: { x: mouseX, y: mouseY },
        }));
        return;
      }
    }

    // Reset hover state if not hovering over an event
    setMouseState((prev) => ({
      ...prev,
      isHovering: false,
      hoverEvent: null,
    }));
  };

  // Handle mouse up to stop panning
  const handleMouseUp = () => {
    setMouseState((prev) => ({
      ...prev,
      isDragging: false,
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
        <div className="flex space-x-2">
          <button
            className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
            onClick={resetView}
          >
            Reset View
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          height={400}
        />
      </div>
    </div>
  );
}
