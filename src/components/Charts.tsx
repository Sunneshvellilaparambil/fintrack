/**
 * FinTrack Chart Components — built on react-native-svg
 * No third-party chart library required.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G, Rect, Defs, LinearGradient, Stop, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../theme';

// ─── Helpers ────────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const clamped = Math.min(endDeg - startDeg, 359.99);
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, startDeg + clamped);
  const large = clamped > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

// ─── DonutChart ─────────────────────────────────────────────────────────────

export interface DonutSlice {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
  showLegend?: boolean;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  size = 160,
  strokeWidth = 22,
  centerLabel,
  centerSub,
  showLegend = true,
}) => {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2 - 4;

  let currentAngle = 0;

  return (
    <View style={donutStyles.wrap}>
      <Svg width={size} height={size}>
        {/* Background ring */}
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={Colors.bgElevated}
          strokeWidth={strokeWidth}
        />
        {slices.map((slice, i) => {
          const sweep = (slice.value / total) * 360;
          const path = arcPath(cx, cy, r, currentAngle, currentAngle + sweep);
          currentAngle += sweep;
          return (
            <Path
              key={i}
              d={path}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          );
        })}
        {/* Center text */}
        {centerLabel && (
          <>
            <SvgText
              x={cx} y={cy - 4}
              textAnchor="middle"
              fill={Colors.textPrimary}
              fontSize={14}
              fontWeight="900"
            >
              {centerLabel}
            </SvgText>
            {centerSub && (
              <SvgText
                x={cx} y={cy + 14}
                textAnchor="middle"
                fill={Colors.textMuted}
                fontSize={10}
              >
                {centerSub}
              </SvgText>
            )}
          </>
        )}
      </Svg>

      {showLegend && (
        <View style={donutStyles.legend}>
          {slices.map((s, i) => (
            <View key={i} style={donutStyles.legendRow}>
              <View style={[donutStyles.legendDot, { backgroundColor: s.color }]} />
              <Text style={donutStyles.legendLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={[donutStyles.legendPct, { color: s.color }]}>
                {((s.value / total) * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const donutStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary },
  legendPct: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});

// ─── BarChart ──────────────────────────────────────────────────────────────

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  subValue?: number; // optional budget cap
}

interface BarChartProps {
  data: BarItem[];
  height?: number;
  barColor?: string;
  showValues?: boolean;
  unit?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 140,
  barColor = Colors.primary,
  showValues = true,
  unit = '₹',
}) => {
  const PAD = { top: 16, bottom: 28, left: 4, right: 4 };
  const chartH = height - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map(d => Math.max(d.value, d.subValue ?? 0)), 1);

  return (
    <View style={{ width: '100%' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${data.length * 52} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={barColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={barColor} stopOpacity="0.4" />
          </LinearGradient>
        </Defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <Line
            key={i}
            x1={PAD.left} y1={PAD.top + chartH * (1 - t)}
            x2={data.length * 52 - PAD.right} y2={PAD.top + chartH * (1 - t)}
            stroke={Colors.border}
            strokeWidth={1}
          />
        ))}
        {data.map((item, i) => {
          const barW = 26;
          const x = i * 52 + 13;
          const barH = (item.value / maxVal) * chartH;
          const barY = PAD.top + chartH - barH;
          const color = item.color ?? barColor;
          return (
            <G key={i}>
              {/* Sub-value (budget cap) */}
              {item.subValue != null && (
                <Rect
                  x={x - barW / 2}
                  y={PAD.top + chartH - (item.subValue / maxVal) * chartH}
                  width={barW}
                  height={(item.subValue / maxVal) * chartH}
                  rx={4}
                  fill={`${color}20`}
                />
              )}
              {/* Main bar */}
              <Rect
                x={x - barW / 2}
                y={barY}
                width={barW}
                height={Math.max(barH, 2)}
                rx={4}
                fill={color}
              />
              {/* Value label */}
              {showValues && (
                <SvgText
                  x={x} y={barY - 4}
                  textAnchor="middle"
                  fill={Colors.textSecondary}
                  fontSize={9}
                >
                  {item.value >= 1000 ? `${(item.value / 1000).toFixed(0)}k` : `${item.value}`}
                </SvgText>
              )}
              {/* X label */}
              <SvgText
                x={x} y={height - 4}
                textAnchor="middle"
                fill={Colors.textMuted}
                fontSize={9}
              >
                {item.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
};

// ─── RadialProgress ─────────────────────────────────────────────────────────

interface RadialProgressProps {
  pct: number;         // 0-100
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sub?: string;
}

export const RadialProgress: React.FC<RadialProgressProps> = ({
  pct,
  color,
  size = 100,
  strokeWidth = 10,
  label,
  sub,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2 - 4;
  const path = arcPath(cx, cy, r, 0, (pct / 100) * 360);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={Colors.bgElevated} strokeWidth={strokeWidth} />
        <Path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        {label && (
          <SvgText x={cx} y={cy - 4} textAnchor="middle" fill={Colors.textPrimary} fontSize={13} fontWeight="900">
            {label}
          </SvgText>
        )}
        {sub && (
          <SvgText x={cx} y={cy + 12} textAnchor="middle" fill={Colors.textMuted} fontSize={9}>
            {sub}
          </SvgText>
        )}
      </Svg>
    </View>
  );
};

// ─── SparkLine ───────────────────────────────────────────────────────────────

interface SparkLineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  filled?: boolean;
}

export const SparkLine: React.FC<SparkLineProps> = ({
  data,
  color = Colors.primary,
  width = 120,
  height = 40,
  filled = true,
}) => {
  if (data.length < 2) return null;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - minVal) / range) * (height - 8) - 4,
  }));

  const polylinePoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    `M ${points[0].x} ${height} ` +
    points.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ` L ${points[points.length - 1].x} ${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {filled && <Path d={areaPath} fill="url(#spark)" />}
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

// ─── HorizontalBar ───────────────────────────────────────────────────────────

interface HorizontalBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  valueLabel?: string;
}

export const HorizontalBar: React.FC<HorizontalBarProps> = ({
  label, value, max, color, valueLabel,
}) => {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  return (
    <View style={hbarStyles.row}>
      <Text style={hbarStyles.label}>{label}</Text>
      <View style={hbarStyles.track}>
        <View style={[hbarStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[hbarStyles.val, { color }]}>{valueLabel ?? value}</Text>
    </View>
  );
};

const hbarStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { width: 72, fontSize: FontSize.xs, color: Colors.textSecondary },
  track: {
    flex: 1, height: 8, backgroundColor: Colors.bgElevated,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: Radius.full },
  val: { width: 48, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textAlign: 'right' },
});

// ─── StackedMiniBar ──────────────────────────────────────────────────────────
// Thin stacked bar showing multiple values in one row (good for income breakdown)

export interface StackedSegment {
  value: number;
  color: string;
  label: string;
}

interface StackedBarProps {
  segments: StackedSegment[];
  height?: number;
}

export const StackedBar: React.FC<StackedBarProps> = ({ segments, height = 14 }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  return (
    <View style={{ gap: 8 }}>
      <View style={[sbarStyles.track, { height }]}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={[sbarStyles.seg, {
              flex: seg.value / total,
              backgroundColor: seg.color,
              borderRadius: i === 0 ? Radius.full : i === segments.length - 1 ? Radius.full : 0,
            }]}
          />
        ))}
      </View>
      <View style={sbarStyles.legend}>
        {segments.map((seg, i) => (
          <View key={i} style={sbarStyles.legendItem}>
            <View style={[sbarStyles.dot, { backgroundColor: seg.color }]} />
            <Text style={sbarStyles.legendText}>{seg.label}</Text>
            <Text style={[sbarStyles.legendPct, { color: seg.color }]}>
              {((seg.value / total) * 100).toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const sbarStyles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.full, overflow: 'hidden', backgroundColor: Colors.bgElevated },
  seg: {},
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  legendPct: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
