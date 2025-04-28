export interface TimelineEvent {
  id: string;
  type: string;
  startTime: number;
  duration: number;
  label: string;
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

// Constants for rendering
export const TRACK_HEIGHT = 40;
export const TRACK_PADDING = 10;
export const TIME_MARKERS_HEIGHT = 30;
export const LEGEND_HEIGHT = 30;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 10;

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
    // We want roughly 5-10 markers visible at any zoom level
    const idealMarkerCount = 8;
    const idealInterval = visibleTimeRange / idealMarkerCount;

    // Find the closest standard interval to our ideal interval
    const standardIntervals = [
      1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000,
    ];
    // Dynamically determine appropriate time interval based on zoom and duration
    const timeInterval = standardIntervals.reduce((prev, curr) =>
      Math.abs(curr - idealInterval) < Math.abs(prev - idealInterval)
        ? curr
        : prev
    );

    // Draw time markers
    ctx.fillStyle = "#888";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";

    const startTime =
      Math.floor(visibleStartTime / timeInterval) * timeInterval;
    const endTime = Math.ceil(visibleEndTime / timeInterval) * timeInterval;

    for (let time = startTime; time <= endTime; time += timeInterval) {
      const x = this.timeToPixel(time);

      // Skip if out of viewport
      if (x < 0 || x > width) continue;

      // Draw marker line
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.strokeStyle = "#3a3a3a";
      ctx.stroke();

      // Format time label based on magnitude
      let timeLabel;
      if (time >= 1000) {
        timeLabel = `${(time / 1000).toFixed(1)}s`;
      } else {
        timeLabel = `${time}ms`;
      }

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
        const eventX = this.timeToPixel(event.startTime);
        const eventWidth = event.duration * this.viewport.scale;

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

  // Draw tooltip for hovered event
  private drawTooltip(
    event: TimelineEvent,
    position: { x: number; y: number }
  ) {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const tooltipWidth = 180;
    const tooltipHeight = 80;
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
      `Type: ${event.type}`,
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
