import { ShowEvent } from "../mockEvents";
import { LangType } from "../lib/translations";

interface CategoryChartProps {
  events: ShowEvent[];
  categoryLabels: Record<string, string>;
  lang: LangType;
}

const CATEGORY_COLORS: Record<string, string> = {
  official: "#f472b6", // rose-400
  fan_event: "#60a5fa", // blue-400
  exhibition: "#c084fc", // purple-400
  ip_collab: "#facc15", // yellow-400
  doujin: "#4ade80", // green-400
  seminar: "#fb923c", // orange-400
};
const FALLBACK_COLOR = "#94a3b8"; // slate-400

// 把角度轉成圓周上的座標點
function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

// 畫甜甜圈圖其中一段圓弧的 SVG path
function describeDonutSegment(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
) {
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);

  return [
    "M",
    outerStart.x,
    outerStart.y,
    "A",
    outerR,
    outerR,
    0,
    largeArcFlag,
    0,
    outerEnd.x,
    outerEnd.y,
    "L",
    innerStart.x,
    innerStart.y,
    "A",
    innerR,
    innerR,
    0,
    largeArcFlag,
    1,
    innerEnd.x,
    innerEnd.y,
    "Z",
  ].join(" ");
}

export default function CategoryChart({
  events,
  categoryLabels,
  lang,
}: CategoryChartProps) {
  const activeEvents = events.filter((e) => !e.deletedAt);
  const counts: Record<string, number> = {};
  activeEvents.forEach((e) => {
    counts[e.type] = (counts[e.type] || 0) + 1;
  });

  const total = activeEvents.length;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (total === 0) {
    return (
      <div className="text-center py-6 text-xs text-slate-600">
        {lang === "zh" ? "目前沒有活動可以統計" : "No events to chart yet"}
      </div>
    );
  }

  let cumulativeAngle = 0;
  const segments = entries.map(([type, count]) => {
    const percentage = count / total;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + percentage * 360;
    cumulativeAngle = endAngle;
    return {
      type,
      count,
      percentage,
      startAngle,
      endAngle,
      color: CATEGORY_COLORS[type] || FALLBACK_COLOR,
    };
  });

  return (
    <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
      <svg viewBox="0 0 200 200" className="w-32 h-32 flex-shrink-0">
        {segments.map((seg) => (
          <path
            key={seg.type}
            d={describeDonutSegment(100, 100, 90, 55, seg.startAngle, seg.endAngle)}
            fill={seg.color}
            opacity={0.9}
          >
            <title>
              {(categoryLabels[seg.type] || seg.type)}:{" "}
              {seg.count} ({Math.round(seg.percentage * 100)}%)
            </title>
          </path>
        ))}
        <text
          x="100"
          y="95"
          textAnchor="middle"
          className="fill-slate-200"
          style={{ fontSize: 28, fontWeight: 700 }}
        >
          {total}
        </text>
        <text
          x="100"
          y="118"
          textAnchor="middle"
          className="fill-slate-500"
          style={{ fontSize: 12 }}
        >
          {lang === "zh" ? "張卡片" : "cards"}
        </text>
      </svg>

      <div className="space-y-1.5 text-xs">
        {segments.map((seg) => (
          <div key={seg.type} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-slate-300">
              {categoryLabels[seg.type] || seg.type}
            </span>
            <span className="text-slate-500 font-mono">
              {seg.count} ({Math.round(seg.percentage * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
