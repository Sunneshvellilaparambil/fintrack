import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Animated, Easing } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../theme';

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'accent' | 'glass' | 'success' | 'danger';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default' }) => {
  const bgColor =
    variant === 'elevated' ? Colors.bgElevated
    : variant === 'accent'  ? Colors.bgCardAlt
    : variant === 'glass'   ? Colors.bgGlass
    : variant === 'success' ? Colors.successDim
    : variant === 'danger'  ? Colors.dangerDim
    : Colors.bgCard;

  const shadow =
    variant === 'elevated' ? Shadow.strong
    : variant === 'success' ? Shadow.success
    : variant === 'danger'  ? Shadow.danger
    : Shadow.card;

  const borderColor =
    variant === 'glass'   ? Colors.borderGlass
    : variant === 'success' ? `${Colors.success}30`
    : variant === 'danger'  ? `${Colors.danger}30`
    : Colors.border;

  return (
    <View style={[styles.card, { backgroundColor: bgColor, borderColor }, shadow, style]}>
      {children}
    </View>
  );
};

// ─── GlowCard (accent top border glow) ────────────────────────────────────────

interface GlowCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glowColor?: string;
}

export const GlowCard: React.FC<GlowCardProps> = ({
  children, style, glowColor = Colors.primary,
}) => (
  <View style={[styles.glowCard, style]}>
    <View style={[styles.glowBar, { backgroundColor: glowColor }]} />
    <View style={styles.glowCardInner}>{children}</View>
  </View>
);

// ─── MetricTile ───────────────────────────────────────────────────────────────

interface MetricTileProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  style?: ViewStyle;
}

export const MetricTile: React.FC<MetricTileProps> = ({ label, value, sub, color, style }) => (
  <View style={[styles.metric, style]}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, color ? { color } : {}]}>{value}</Text>
    {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
  </View>
);

// ─── ProgressBar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  pct: number;
  color?: string;
  height?: number;
  style?: ViewStyle;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  pct, color = Colors.primary, height = 8, style,
}) => {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <View style={[styles.progressBg, { height }, style]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${clamped}%`,
            backgroundColor: color,
            height,
          },
        ]}
      />
      {/* Shimmer highlight */}
      <View style={[styles.progressShimmer, { width: `${clamped}%`, height }]} />
    </View>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color = Colors.textPrimary,
  bgColor = Colors.bgElevated,
}) => (
  <View style={[styles.badge, { backgroundColor: bgColor, borderColor: `${color}30` }]}>
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
);

// ─── SectionHeader ────────────────────────────────────────────────────────────

export const SectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({
  title, action,
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionDot} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {action}
  </View>
);

// ─── StatRow ──────────────────────────────────────────────────────────────────

interface StatItem { label: string; value: string; color?: string }

export const StatRow: React.FC<{ items: StatItem[] }> = ({ items }) => (
  <View style={styles.statRow}>
    {items.map((item, i) => (
      <React.Fragment key={item.label}>
        {i > 0 && <View style={styles.statSep} />}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{item.label}</Text>
          <Text style={[styles.statValue, item.color ? { color: item.color } : {}]}>
            {item.value}
          </Text>
        </View>
      </React.Fragment>
    ))}
  </View>
);

import Icon from 'react-native-vector-icons/Ionicons';

// ─── EmptyState ───────────────────────────────────────────────────────────────

export const EmptyState: React.FC<{ icon: string; title: string; description: string }> = ({
  icon, title, description,
}) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconContainer}>
      <Icon name={icon} size={32} color={Colors.textMuted} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyDesc}>{description}</Text>
  </View>
);

// ─── Divider ──────────────────────────────────────────────────────────────────

export const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.divider, style]} />
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    ...Shadow.card,
  },
  glowCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
  },
  glowBar: {
    height: 3,
    width: '100%',
    opacity: 0.9,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  glowCardInner: {
    padding: Spacing.base,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    fontWeight: FontWeight.black,
    letterSpacing: -0.5,
  },
  metricSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  progressBg: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: Radius.full,
    position: 'absolute',
  },
  progressShimmer: {
    position: 'absolute',
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statSep: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
});
