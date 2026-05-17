import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NFTBadge } from './NFTBadge';

interface MemberCardProps {
  displayName: string;
  walletAddress: string;
  tier: string;
  tierColor: string;
  subscriptionStatus: 'active' | 'expired' | 'none';
  onPress?: () => void;
}

export function MemberCard({
  displayName,
  walletAddress,
  tier,
  tierColor,
  subscriptionStatus,
  onPress,
}: MemberCardProps) {
  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  const statusColor =
    subscriptionStatus === 'active'
      ? '#34C759'
      : subscriptionStatus === 'expired'
        ? '#FF3B30'
        : '#8E8E93';

  const statusLabel =
    subscriptionStatus === 'active'
      ? 'Active'
      : subscriptionStatus === 'expired'
        ? 'Expired'
        : 'No Subscription';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <NFTBadge tier={tier} color={tierColor} size="medium" />
        <View style={styles.headerText}>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.walletAddress}>{shortAddress}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  walletAddress: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
