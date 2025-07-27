# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 React performance monitoring tool focused on comprehensive timeline-based profiling. The application provides real-time visualization of multiple performance metrics including render timings, user input events, and network resource loading, all synchronized with session recording capabilities.

## Development Commands

- `npm run dev` - Start development server on port 3030 with Turbopack
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

## Architecture

### Core Components

**Timeline Profiling System (`src/app/test.tsx` - ProfilerTimeline)**
- Comprehensive performance tracking using multiple PerformanceObserver APIs
- Tracks three event types: render events, user input events, network resources
- Baseline timestamp management for relative time measurements
- Extensible event tracking system that can be expanded for additional metrics

**Timeline Visualization (`src/components/timeline/`)**
- Custom canvas-based timeline renderer with interactive zoom/pan controls
- High-performance rendering for large datasets
- Mouse wheel zoom and Command+drag panning
- Click-to-jump functionality synchronized with session replay

**Session Recording (`src/app/replayer.tsx`)**
- Uses rrweb for DOM recording and playback
- Synchronized with timeline events for debugging
- Jump-to-time functionality from timeline events

**Legacy API Layer (`src/app/api/profiler/route.ts`)**
- File-based storage system (currently unused in main flow)
- Available for future session persistence features

### Key Features

- **Multi-dimensional Performance Tracking**:
  - React component render timing via react-scan integration
  - User input event timing (input, click) via PerformanceObserver
  - Network resource timing with configurable whitelist filtering
- **Interactive Timeline Visualization**:
  - Canvas-based rendering for smooth performance
  - Zoom/pan controls with Command key modifier
  - Event click-to-jump functionality
- **Session Recording Integration**:
  - Synchronized DOM replay with performance timeline
  - Baseline timestamp coordination between recording and profiling
- **Extensible Architecture**:
  - Easy to add new event track types
  - Modular PerformanceObserver integration
  - Configurable event filtering and processing

### Performance Tracking Implementation

**Event Track System**:
- Three predefined tracks: `network-resource`, `user-input`, `render`
- Map-based state management with `ProfilerTimelineEventTracks` provider
- Baseline timestamp synchronization for relative time calculations

**PerformanceObserver Integration**:
- **Event Timing**: Captures user input events (input, click) with duration tracking
- **Resource Timing**: Monitors network requests with whitelist filtering
- **React Scan Integration**: Component render timing with fiber inspection
- All observers use baseline timestamp for consistent relative timing

### Technology Stack

- **Framework**: Next.js 15 with App Router
- **React**: v19 with concurrent features (useDeferredValue)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts for data visualization
- **UI Components**: Radix UI primitives
- **Performance**: react-scan for component monitoring
- **Recording**: rrweb for session capture

### File Structure

- `src/app/` - Main application pages and API routes
- `src/components/` - Reusable UI components and timeline renderer
- `src/lib/` - Utility functions
- `profiler-data/` - File storage for profiler sessions

### Development Notes

**Timeline Implementation**:
- Canvas-based rendering for handling large event datasets
- Baseline timestamp approach ensures all events are relative to profiling start
- `eventTracksRef` pattern prevents infinite re-renders with react-scan

**Extensibility Patterns**:
- Add new event tracks by extending `initEventTracks()` function
- Implement additional PerformanceObserver types following existing patterns
- Resource whitelist in `isResourceIncludedInWhiteList()` can be customized
- Event filtering logic is modular and configurable

**Performance Integration**:
- react-scan provides component-level render timing
- Custom performance.mark/measure in TestComponent for user-defined metrics
- All timing data synchronized through baseline timestamp system
- Session recording and timeline events share the same time coordinate system