import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NFTBadgeProps {
  tier: string;
  color: string;
  size?: 'small' | 'medium' | 'large';
}

const sizeMap = {
  small: { badge: 32, icon: 14, label: 8 },
  medium: { badge: 48, icon: 20, label: 10 },
  large: { badge: 64, icon: 28, label: 12 },
};

const tierIcons: Record<string, string> = {
  Basic: '★',
  Premium: '◆',
  Exclusive: '♛',
  Admin: '⚙',
};

export function NFTBadge({ tier, color, size = 'medium' }: NFTBadgeProps) {
  const dims = sizeMap[size];
  const icon = tierIcons[tier] || '●';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: dims.badge,
            height: dims.badge,
            borderRadius: dims.badge / 2,
            backgroundColor: color + '20',
            borderColor: color,
          },
        ]}
      >
        <Text style={[styles.icon, { fontSize: dims.icon, color }]}>{icon}</Text>
      </View>
      <Text
        style={[
          styles.label,
          {
            fontSize: dims.label,
            color,
            marginTop: size === 'large' ? 4 : 2,
          },
        ]}
      >
        {tier}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  icon: {
    fontWeight: '700',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
