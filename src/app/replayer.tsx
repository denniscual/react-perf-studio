"use client";

// App.jsx
import {
  useCallback,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";
import * as rrweb from "rrweb";

const SessionRecorder = (props: any) => {
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const playerRef = useRef(null);
  const stopRecordingRef = useRef<() => void | null>(null);

  const playRecordingRef = useRef<any>(null);

  useInsertionEffect(() => {
    playRecordingRef.current = () => {
      if (!events.length || !playerRef.current) return;

      if (playerInstance) {
        playerInstance.$destroy(); // Destroy existing player before re-creating
      }

      const player = new rrwebPlayer({
        target: playerRef.current,
        props: {
          events: events,
          width: 900,
        },
      });

      setPlayerInstance(player);
    };
  });

  const playRecording = useCallback(() => {
    playRecordingRef.current();
  }, []);

  const value = useMemo(() => {
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

    return {
      recording,
      startRecording,
      stopRecording,
      playRecording,
      events,
      playerRef,
    };
  }, [events, playRecording, playerInstance, recording]);

  return props.children(value);
};

export default SessionRecorder;
