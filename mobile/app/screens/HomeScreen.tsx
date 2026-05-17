import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/auth';
import { MemberCard } from '../components/MemberCard';
import { apiClient, MembershipTier } from '../services/api';
import { getNFTBalance } from '../services/contracts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const tierBanners: Record<string, { label: string; color: string }> = {
  Basic: { label: 'Basic · Free', color: '#8E8E93' },
  Premium: { label: 'Premium · $9.99/mo', color: '#FFD60A' },
  Exclusive: { label: 'Exclusive · $24.99/mo', color: '#FF375F' },
};

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, walletAddress } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [nftCount, setNftCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const tiersData = await apiClient.get<MembershipTier[]>('/membership/tiers');
      setTiers(tiersData);
      if (walletAddress) {
        const count = await getNFTBalance(walletAddress);
        setNftCount(count);
      }
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const activeTier = user?.membershipTier || 'Basic';
  const banner = tierBanners[activeTier] || tierBanners.Basic;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.banner, { borderColor: banner.color }]}>
        <Text style={[styles.bannerTier, { color: banner.color }]}>{activeTier}</Text>
        <Text style={styles.bannerLabel}>{banner.label}</Text>
      </View>

      {user && (
        <MemberCard
          displayName={user.displayName}
          walletAddress={user.walletAddress}
          tier={user.membershipTier}
          tierColor={banner.color}
          subscriptionStatus={user.subscriptionStatus as any}
          onPress={() => navigation.navigate('Profile')}
        />
      )}

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Content')}
          >
            <Text style={styles.actionIcon}>🎬</Text>
            <Text style={styles.actionLabel}>Browse Content</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Verify')}
          >
            <Text style={styles.actionIcon}>✅</Text>
            <Text style={styles.actionLabel}>Verify Age</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionLabel}>My Membership</Text>
          </TouchableOpacity>
        </View>
      </View>

      {walletAddress && (
        <View style={styles.walletSection}>
          <Text style={styles.sectionTitle}>Connected Wallet</Text>
          <View style={styles.walletCard}>
            <Text style={styles.walletLabel}>Address</Text>
            <Text style={styles.walletValue} selectable>
              {walletAddress}
            </Text>
            <View style={styles.walletStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{nftCount}</Text>
                <Text style={styles.statLabel}>NFTs</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {tiers.length > 0 && (
        <View style={styles.tiersSection}>
          <Text style={styles.sectionTitle}>Membership Tiers</Text>
          {tiers.map((tier) => (
            <View
              key={tier.id}
              style={[styles.tierCard, { borderLeftColor: tier.color }]}
            >
              <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
              <Text style={styles.tierPrice}>{tier.price}</Text>
              {tier.benefits.map((benefit, i) => (
                <Text key={i} style={styles.tierBenefit}>
                  • {benefit}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
  },
  bannerTier: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bannerLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  quickActions: {
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#AEAEB2',
    fontWeight: '600',
    textAlign: 'center',
  },
  walletSection: {
    marginTop: 8,
  },
  walletCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  walletLabel: {
    fontSize: 12,
    color: '#636366',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  walletValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  walletStats: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  statItem: {
    marginRight: 24,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  tiersSection: {
    marginTop: 8,
    marginBottom: 32,
  },
  tierCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  tierName: {
    fontSize: 18,
    fontWeight: '700',
  },
  tierPrice: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
    marginBottom: 8,
  },
  tierBenefit: {
    fontSize: 13,
    color: '#AEAEB2',
    lineHeight: 20,
  },
});
