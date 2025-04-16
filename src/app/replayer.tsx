"use client";

import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useRef,
  useState,
} from "react";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";
import * as rrweb from "rrweb";

interface SessionRecorderProps {
  children: (value: {
    recording: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    playRecording: () => void;
    events: any[];
    playerRef: React.RefObject<HTMLDivElement>;
    setTimeOffset: (offset: number) => void;
    jumpToTime: (index: number) => void;
  }) => React.ReactNode;
  initialTimeOffset?: number;
}

const SessionRecorder = (props: SessionRecorderProps) => {
  const { initialTimeOffset = -1000 } = props;

  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [timeOffset, setTimeOffset] = useState(initialTimeOffset);

  const playerRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<any[]>([]);
  const stopRecordingRef = useRef<(() => void) | null>(null);

  // Clean up player on unmount
  useEffect(() => {
    return () => {
      if (playerInstance) {
        try {
          playerInstance.$destroy();
        } catch (err) {
          console.error("Error destroying player:", err);
        }
      }
    };
  }, [playerInstance]);

  // Process events with time offset
  const getProcessedEvents = useCallback(
    (rawEvents: any[]) => {
      if (!rawEvents.length) return [];

      return rawEvents.map((event, index) => {
        // Make a copy to avoid mutation
        const newEvent = { ...event };

        // Apply time offset to all events
        if (timeOffset !== 0) {
          newEvent.timestamp += timeOffset;
        }

        // Ensure proper timing between consecutive events
        if (index > 0) {
          const prevEvent = rawEvents[index - 1];
          const minDiff = 10; // Minimum 10ms between events

          if (newEvent.timestamp - prevEvent.timestamp < minDiff) {
            newEvent.timestamp = prevEvent.timestamp + minDiff;
          }
        }

        return newEvent;
      });
    },
    [timeOffset]
  );

  const startRecording = useCallback(() => {
    // Clean up existing player
    if (playerInstance) {
      try {
        playerInstance.$destroy();
        setPlayerInstance(null);
      } catch (err) {
        console.error("Error destroying player:", err);
      }
    }

    // Reset events
    setEvents([]);
    eventsRef.current = [];

    // Start new recording
    const stopFn = rrweb.record({
      emit(event) {
        eventsRef.current.push(event);
      },
      recordCanvas: true,
      collectFonts: true,
    });

    stopRecordingRef.current = () => {
      stopFn?.();
      setEvents([...eventsRef.current]);
      setRecording(false);
    };

    setRecording(true);
  }, [playerInstance]);

  const stopRecording = useCallback(() => {
    if (stopRecordingRef.current) {
      stopRecordingRef.current();
    }
  }, []);

  const playRecordingRef = useRef<any>(null);

  useInsertionEffect(() => {
    playRecordingRef.current = () => {
      if (!events.length || !playerRef.current) return;

      // Clean up existing player
      if (playerInstance) {
        try {
          playerInstance.$destroy();
        } catch (err) {
          console.error("Error destroying player:", err);
        }
      }

      // Get processed events with proper timing and offsets
      const processedEvents = getProcessedEvents(events);

      // Create new player
      try {
        // Clear container first
        if (playerRef.current.firstChild) {
          playerRef.current.innerHTML = "";
        }

        const player = new rrwebPlayer({
          target: playerRef.current,
          props: {
            events: processedEvents,
            width: 710,
            showController: true,
            autoPlay: true,
          },
        });
        setPlayerInstance(player);
        player.pause(); // pause immediately after creation
      } catch (err) {
        console.error("Error creating player:", err);
      }
    };
  });

  const playRecording = useCallback(() => {
    playRecordingRef.current?.();
  }, []);

  // Function to jump to a specific event by index
  const jumpToTime = useCallback(
    (time: number) => {
      if (!playerInstance) {
        return;
      }
      playerInstance.goto(time);
      playerInstance.pause();
    },
    [playerInstance]
  );

  // Export all necessary functions and state
  const value = {
    recording,
    startRecording,
    stopRecording,
    playRecording,
    events,
    playerRef,
    setTimeOffset,
    jumpToTime,
  };

  return props.children(value);
};

export default SessionRecorder;
