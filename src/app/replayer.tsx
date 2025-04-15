"use client";

// App.jsx
import React, { useRef, useState } from "react";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";
import * as rrweb from "rrweb";

const SessionRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const playerRef = useRef(null);
  const stopRecordingRef = useRef<() => void | null>(null);

  const startRecording = () => {
    if (playerInstance) {
      playerInstance.$destroy(); // Destroy existing player before re-creating
      setEvents([]);
    }

    const recordedEvents: any[] = [];
    const stopFn = rrweb.record({
      emit(event) {
        recordedEvents.push(event);
      },
    });

    stopRecordingRef.current = () => {
      stopFn?.();
      setEvents(recordedEvents);
      setRecording(false);
    };
    setRecording(true);
  };

  const stopRecording = () => {
    if (stopRecordingRef.current) {
      stopRecordingRef.current();
    }
  };

  const playRecording = () => {
    if (!events.length || !playerRef.current) return;

    if (playerInstance) {
      playerInstance.$destroy(); // Destroy existing player before re-creating
    }

    const player = new rrwebPlayer({
      target: playerRef.current,
      props: {
        events: events,
      },
    });

    setPlayerInstance(player);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6 bg-gray-100">
      <div className="flex space-x-4">
        {!recording ? (
          <button
            className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700"
            onClick={startRecording}
          >
            Start Recording
          </button>
        ) : (
          <button
            className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700"
            onClick={stopRecording}
          >
            Stop Recording
          </button>
        )}
        <button
          className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={playRecording}
          disabled={!events.length}
        >
          Play Recording
        </button>
      </div>
      <div
        ref={playerRef}
        className="w-full max-w-4xl border border-gray-300 rounded-lg bg-white shadow"
      />
    </div>
  );
};

export default SessionRecorder;
