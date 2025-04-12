// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const Timeline = ({ renders, inputs }: any) => {
  // Define the events data with an added "category" property to group events
  const events = [
    // Input events (y: 2)
    ...inputs,
    // Render events (y: 3)
    ...renders,
  ];

  // Custom tick formatter to add 'ms' suffix
  const formatXAxis = (value) => `${value} ms`;

  // Custom tooltip formatter
  const customTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 p-2 border border-gray-700 rounded text-white">
          <p className="font-semibold">{data.type}</p>
          <p>Category: {data.category}</p>
          <p>Start: {data.start} ms</p>
          <p>End: {data.end} ms</p>
          <p>Duration: {data.end - data.start} ms</p>
        </div>
      );
    }
    return null;
  };

  // Custom Y-axis tick formatter to show category labels
  const formatYAxis = (value) => {
    switch (value) {
      case 2:
        return "Input Events";
      case 3:
        return "Render Events";
      default:
        return "";
    }
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg">
      <h2 className="text-xl mb-4">
        User Input Events and Render Events Timeline
      </h2>
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 50, right: 20, bottom: 20, left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis
              type="number"
              dataKey="x"
              name="Time"
              domain={[0, 10000]}
              tickFormatter={formatXAxis}
              stroke="#999"
              ticks={[
                100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200,
                1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
              ]}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Track"
              domain={[1, 4]}
              tickCount={2}
              ticks={[2, 3]}
              tickFormatter={formatYAxis}
              tick={{ fill: "#999" }}
              stroke="#666"
            />
            <Tooltip content={customTooltip} />

            {events.map((event, index) => (
              <Scatter
                key={`scatter-${index}`}
                name={`${event.type}-${index}`}
                data={[
                  {
                    x: (event.start + event.end) / 2,
                    y: event.y,
                    start: event.start,
                    end: event.end,
                    type: event.type,
                    category: event.category,
                    color: event.color,
                  },
                ]}
                shape={(props) => (
                  <rect
                    x={props.cx - (props.cx - props.xAxis.scale(event.start))}
                    y={props.cy - 20}
                    width={
                      props.xAxis.scale(event.end) -
                      props.xAxis.scale(event.start)
                    }
                    height={30}
                    fill={event.color}
                    stroke="black"
                    strokeWidth={1}
                    rx={2}
                    ry={2}
                  />
                )}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex mt-2 flex-wrap">
        <div className="mr-4 mb-2 flex items-center">
          <div className="w-4 h-4 bg-blue-400 mr-2"></div>
          <span>Keyboard</span>
        </div>
        <div className="mr-4 mb-2 flex items-center">
          <div className="w-4 h-4 bg-orange-500 mr-2"></div>
          <span>Click</span>
        </div>
        <div className="mr-4 mb-2 flex items-center">
          <div className="w-4 h-4 bg-green-500 mr-2"></div>
          <span>Drag</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-purple-500 mr-2"></div>
          <span>Render</span>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
