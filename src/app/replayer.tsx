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
    jumpToTime: (index: number) => void;
    currentTime: number;
    isPlaying: boolean;
  }) => React.ReactNode;
  initialTimeOffset?: number;
}

const SessionRecorder = (props: SessionRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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

      // Create new player
      try {
        // Clear container first
        if (playerRef.current.firstChild) {
          playerRef.current.innerHTML = "";
        }

        const player = new rrwebPlayer({
          target: playerRef.current,
          props: {
            events,
            width: 710,
            showController: true,
            autoPlay: true,
          },
        });

        // Listen for time updates from the player
        player.addEventListener("ui-update-current-time", (event) => {
          if (event && typeof event.payload === "number") {
            setCurrentTime(event.payload);
          }
        });

        // Listen for play state changes
        player.addEventListener("start", () => {
          console.log("Player started");
          setIsPlaying(true);
        });

        player.addEventListener("pause", () => {
          console.log("Player paused");
          setIsPlaying(false);
        });

        player.addEventListener("resume", () => {
          console.log("Player resumed");
          setIsPlaying(true);
        });

        player.addEventListener("finish", () => {
          console.log("Player finished");
          setIsPlaying(false);
          setCurrentTime(0);
        });

        setPlayerInstance(player);
        setCurrentTime(0);
        setIsPlaying(false);
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
      setCurrentTime(time);
      setIsPlaying(false);
    },
    [playerInstance],
  );

  // Export all necessary functions and state
  const value = {
    recording,
    startRecording,
    stopRecording,
    playRecording,
    events,
    playerRef,
    jumpToTime,
    currentTime,
    isPlaying,
  };

  return props.children(value);
};

export default SessionRecorder;
