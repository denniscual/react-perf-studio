export interface TimelineEvent {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  duration: number;
  eventTrackId: string;
}

export interface EventTrack {
  id: string;
  label: string;
  events: TimelineEvent[];
  color: string;
}

export interface Viewport {
  offsetX: number;
  scale: number;
  startTime: number;
  endTime: number;
}

export interface MouseState {
  isDragging: boolean;
  lastX: number;
  isHovering: boolean;
  hoverEvent: TimelineEvent | null;
  hoverPosition: { x: number; y: number };
}

export const TRACK_HEIGHT = 40;
export const TRACK_PADDING = 10;
export const TIME_MARKERS_HEIGHT = 30;
export const LEGEND_HEIGHT = 30;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 100;

export class TimelineRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tracks: EventTrack[] = [];
  private viewport: Viewport = {
    offsetX: 0,
    scale: 1,
    startTime: 0,
    endTime: 800,
  };
  private mouseState: MouseState = {
    isDragging: false,
    lastX: 0,
    isHovering: false,
    hoverEvent: null,
    hoverPosition: { x: 0, y: 0 },
  };
  private onEventClick: ((event: TimelineEvent) => void) | null = null;
  private currentTime: number = 0;
  private isPlaying: boolean = false;

  constructor(canvas: HTMLCanvasElement | null) {
    this.setCanvas(canvas);
  }

  setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext("2d") || null;
  }

  setTracks(tracks: EventTrack[]) {
    this.tracks = tracks;
  }

  setViewport(viewport: Viewport) {
    this.viewport = viewport;
  }

  setMouseState(mouseState: MouseState) {
    this.mouseState = mouseState;
  }

  setOnEventClick(callback: (event: TimelineEvent) => void) {
    this.onEventClick = callback;
  }

  setCurrentTime(time: number, isPlaying: boolean) {
    this.currentTime = time;
    this.isPlaying = isPlaying;
  }

  // Find the event at a specific position
  findEventAtPosition(x: number, y: number): TimelineEvent | null {
    // If y position is in the legend or time markers area, return null
    if (y <= TIME_MARKERS_HEIGHT + LEGEND_HEIGHT) return null;

    // Calculate which track the click is on
    const trackIndex = Math.floor(
      (y - TIME_MARKERS_HEIGHT - LEGEND_HEIGHT) / (TRACK_HEIGHT + TRACK_PADDING)
    );

    // Check if trackIndex is valid
    if (trackIndex < 0 || trackIndex >= this.tracks.length) return null;

    const track = this.tracks[trackIndex];
    const time = this.pixelToTime(x);

    // Find the event that contains this time point
    return (
      track.events.find(
        (event) =>
          time >= event.startTime && time <= event.startTime + event.duration
      ) || null
    );
  }

  // Handle click events on the canvas
  handleClick(x: number, y: number) {
    const event = this.findEventAtPosition(x, y);
    if (event && this.onEventClick) {
      this.onEventClick(event);
    }
  }

  // Convert time to pixel position
  timeToPixel(time: number): number {
    const { scale, offsetX } = this.viewport;
    return (time - this.viewport.startTime) * scale - offsetX;
  }

  // Convert pixel position to time
  pixelToTime(pixel: number): number {
    const { scale, offsetX } = this.viewport;
    return (pixel + offsetX) / scale + this.viewport.startTime;
  }

  // Draw the timeline
  drawTimeline() {
    if (!this.canvas || !this.ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // Draw background
    this.ctx.fillStyle = "#1a1a1a";
    this.ctx.fillRect(0, 0, width, height);

    // Draw grid lines and time markers
    this.drawTimeGrid(width, height);

    // Draw tracks
    this.drawTracks();

    // Draw events
    this.drawEvents();

    // Draw time indicator
    this.drawTimeIndicator();

    // Draw tooltip if hovering over an event
    if (this.mouseState.isHovering && this.mouseState.hoverEvent) {
      this.drawTooltip(
        this.mouseState.hoverEvent,
        this.mouseState.hoverPosition
      );
    }
  }

  // Draw time grid and markers
  private drawTimeGrid(width: number, height: number) {
    if (!this.ctx) return;

    const ctx = this.ctx;
    ctx.fillStyle = "#242424";
    ctx.fillRect(0, 0, width, height);

    // Draw time markers
    ctx.fillStyle = "#2d2d2d";
    ctx.fillRect(0, 0, width, TIME_MARKERS_HEIGHT);

    // Calculate the visible time range
    const visibleStartTime = this.pixelToTime(0);
    const visibleEndTime = this.pixelToTime(width);
    const visibleTimeRange = visibleEndTime - visibleStartTime;

    // Adjust interval based on zoom level
    // We want roughly 5-10 markers visible at any zoom level, but allow finer intervals for high zoom
    const idealMarkerCount = 8;
    const idealInterval = visibleTimeRange / idealMarkerCount;

    // Find the closest standard interval to our ideal interval
    const standardIntervals = [
      1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000,
    ];

    // Dynamically determine appropriate time interval based on zoom and duration
    // Calculate the ideal interval to maintain 8-10 markers
    let timeInterval = Math.ceil(idealInterval);
    
    // For very fine zoom levels, ensure we can still show increments of 1
    if (timeInterval < 1) {
      timeInterval = 1;
    }
    
    // If calculated interval would create too many markers, find the closest standard interval
    if (visibleTimeRange / timeInterval > 15) {
      timeInterval = standardIntervals.reduce((prev, curr) =>
        Math.abs(curr - idealInterval) < Math.abs(prev - idealInterval)
          ? curr
          : prev
      );
    }

    // Draw time markers
    ctx.fillStyle = "#888";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";

    // Calculate start time aligned to interval
    const startTime =
      Math.floor(visibleStartTime / timeInterval) * timeInterval;
    const endTime = Math.ceil(visibleEndTime / timeInterval) * timeInterval;

    // Create a set to track used positions to avoid duplicates
    const usedPositions = new Set<number>();

    for (let time = startTime; time <= endTime; time += timeInterval) {
      const x = Math.round(this.timeToPixel(time));

      // Skip if out of viewport or already used (prevents duplicates)
      if (x < 0 || x > width || usedPositions.has(x)) continue;

      // Mark this position as used
      usedPositions.add(x);

      // Draw marker line
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.strokeStyle = "#3a3a3a";
      ctx.stroke();

      // Format time label based on magnitude
      const timeLabel = `${time}ms`;

      // Draw time label
      ctx.fillText(timeLabel, x, 20);
    }

    // Draw legend at the top
    this.drawLegend(width);
  }

  // Draw legend at the top
  private drawLegend(width: number) {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const legendHeight = 26;
    const legendY = TIME_MARKERS_HEIGHT + 4;
    const legendItemWidth = 120;
    const legendPadding = 10;

    // Calculate total width needed for legend
    const totalLegendWidth =
      this.tracks.length * (legendItemWidth + legendPadding);

    // Center the legend
    const startX = Math.max(10, (width - totalLegendWidth) / 2);

    // Draw legend background
    ctx.fillStyle = "rgba(30, 30, 30, 0.7)";
    ctx.fillRect(startX - 10, legendY - 4, totalLegendWidth + 20, legendHeight);

    // Draw legend items
    this.tracks.forEach((track, index) => {
      const itemX = startX + index * (legendItemWidth + legendPadding);

      // Draw color box
      ctx.fillStyle = track.color;
      ctx.fillRect(itemX, legendY + 4, 12, 12);

      // Draw label
      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.textAlign = "left";
      ctx.fillText(track.label, itemX + 20, legendY + 14);
    });
  }

  // Draw tracks backgrounds and borders
  private drawTracks() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    this.tracks.forEach((track, index) => {
      const y =
        TIME_MARKERS_HEIGHT + 36 + index * (TRACK_HEIGHT + TRACK_PADDING);

      // Draw track lane divider
      ctx.beginPath();
      ctx.moveTo(0, y + TRACK_HEIGHT);
      ctx.lineTo(this.canvas!.width, y + TRACK_HEIGHT);
      ctx.strokeStyle = "#333";
      ctx.stroke();
    });
  }

  // Draw events on tracks
  private drawEvents() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    this.tracks.forEach((track, trackIndex) => {
      const trackY =
        TIME_MARKERS_HEIGHT + 36 + trackIndex * (TRACK_HEIGHT + TRACK_PADDING);

      track.events.forEach((event) => {
        // Use exact pixel calculations to ensure events align with time grid
        const eventX = Math.round(this.timeToPixel(event.startTime));
        const eventEndX = Math.round(
          this.timeToPixel(event.startTime + event.duration)
        );
        const eventWidth = Math.max(1, eventEndX - eventX); // Ensure minimum width of 1px

        // Skip if event is outside the viewport
        if (eventX + eventWidth < 0 || eventX > this.canvas!.width) return;

        // Draw event background
        ctx.fillStyle = track.color;
        const roundedRadius = Math.min(4, eventWidth / 2);
        this.roundedRect(
          eventX,
          trackY + 4,
          eventWidth,
          TRACK_HEIGHT - 8,
          roundedRadius
        );

        // Draw event label if there's enough space
        if (eventWidth > 20) {
          ctx.fillStyle = "#fff";
          ctx.font = "10px Arial";
          ctx.textAlign = "left";
          ctx.fillText(
            this.truncateText(event.label, eventWidth - 8),
            eventX + 4,
            trackY + TRACK_HEIGHT / 2 + 3
          );
        }
      });
    });
  }

  // Helper function to draw rounded rectangles
  private roundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    if (!this.ctx) return;

    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  // Helper function to truncate text
  private truncateText(text: string, maxWidth: number): string {
    if (!this.ctx) return text;

    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxWidth) return text;

    let truncated = text;
    while (
      ctx.measureText(truncated + "...").width > maxWidth &&
      truncated.length > 0
    ) {
      truncated = truncated.slice(0, -1);
    }

    return truncated + (truncated.length < text.length ? "..." : "");
  }

  // Draw time indicator
  private drawTimeIndicator() {
    if (!this.ctx || !this.canvas || this.currentTime < 0) return;

    const ctx = this.ctx;
    const indicatorX = this.timeToPixel(this.currentTime);

    // Only draw if the indicator is within the visible area
    if (indicatorX < 0 || indicatorX > this.canvas.width) return;

    // Choose color based on playing state
    const color = this.isPlaying ? "#ff3333" : "#ff8844"; // Bright red when playing, orange when paused

    // Draw the vertical line
    ctx.beginPath();
    ctx.moveTo(indicatorX, TIME_MARKERS_HEIGHT);
    ctx.lineTo(indicatorX, this.canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw a circle at the top
    ctx.beginPath();
    ctx.arc(indicatorX, TIME_MARKERS_HEIGHT + 8, 4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Draw time label
    ctx.fillStyle = "#fff";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(indicatorX - 25, TIME_MARKERS_HEIGHT + 15, 50, 16);
    ctx.fillStyle = "#fff";
    ctx.fillText(
      `${this.currentTime.toFixed(0)}ms`,
      indicatorX,
      TIME_MARKERS_HEIGHT + 26
    );
  }

  // Draw tooltip for hovered event
  private drawTooltip(
    event: TimelineEvent,
    position: { x: number; y: number }
  ) {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const tooltipWidth = 200;
    const tooltipHeight = 90;
    const padding = 8;

    // Adjust position to ensure tooltip stays within canvas
    let tooltipX = position.x + 10;
    let tooltipY = position.y + 10;

    if (tooltipX + tooltipWidth > this.canvas.width) {
      tooltipX = position.x - tooltipWidth - 10;
    }

    if (tooltipY + tooltipHeight > this.canvas.height) {
      tooltipY = position.y - tooltipHeight - 10;
    }

    // Draw tooltip background
    ctx.fillStyle = "rgba(30, 30, 30, 0.9)";
    this.roundedRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);

    // Draw tooltip border
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
    ctx.stroke();

    // Draw tooltip content
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText(event.label, tooltipX + padding, tooltipY + padding + 12);

    ctx.font = "11px Arial";
    ctx.fillText(
      `ID: ${event.id}`,
      tooltipX + padding,
      tooltipY + padding + 30
    );
    ctx.fillText(
      `Start: ${event.startTime}ms`,
      tooltipX + padding,
      tooltipY + padding + 45
    );
    ctx.fillText(
      `Duration: ${event.duration}ms`,
      tooltipX + padding,
      tooltipY + padding + 60
    );
  }

  // Resize handling
  resizeCanvas() {
    if (!this.canvas) return;
    this.drawTimeline();
  }
}
