import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontWeight, Radius } from '../theme';

interface AppIconProps {
  size?: number;
}

/**
 * FinTrack App Icon — Pure View-based, no SVG dependency.
 * Renders a branded "F" on a dark rounded background with accent glow.
 */
const AppIcon: React.FC<AppIconProps> = ({ size = 100 }) => {
  const fontSize = size * 0.48;
  const borderR = size * 0.22;

  return (
    <View style={[styles.outer, { width: size, height: size, borderRadius: borderR }]}>
      <View style={[styles.inner, { width: size, height: size, borderRadius: borderR }]}>
        {/* Accent dot — top right */}
        <View style={[styles.accentDot, {
          width: size * 0.12,
          height: size * 0.12,
          borderRadius: size * 0.06,
          top: size * 0.15,
          right: size * 0.18,
        }]} />
        {/* "F" */}
        <Text style={[styles.letter, { fontSize, lineHeight: fontSize * 1.1 }]}>F</Text>
        {/* Arrow accent — tiny triangle */}
        <View style={[styles.arrowWrap, {
          bottom: size * 0.14,
          right: size * 0.16,
        }]}>
          <Text style={[styles.arrow, { fontSize: size * 0.22 }]}>↗</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    shadowColor: '#7C6EFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 16,
  },
  inner: {
    backgroundColor: '#0D1220',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(124,110,255,0.2)',
    overflow: 'hidden',
  },
  letter: {
    color: '#7C6EFF',
    fontWeight: FontWeight.black,
    letterSpacing: -2,
  },
  accentDot: {
    position: 'absolute',
    backgroundColor: '#00E5A0',
    opacity: 0.6,
  },
  arrowWrap: {
    position: 'absolute',
  },
  arrow: {
    color: '#00E5A0',
    fontWeight: FontWeight.bold,
  },
});

export default AppIcon;
