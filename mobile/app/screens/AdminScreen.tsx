import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../services/auth';
import { adminApi, UserProfile, PlatformMetrics } from '../services/api';

export function AdminScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [complianceSummary, setComplianceSummary] = useState<{
    totalChecks: number;
    passRate: number;
    recentFlags: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [metricsData, complianceData] = await Promise.all([
        adminApi.getMetrics(),
        adminApi.getComplianceSummary(),
      ]);
      setMetrics(metricsData);
      setComplianceSummary(complianceData);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await adminApi.searchUsers(searchQuery);
      setSearchResults(results);
    } catch {
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  if (!user?.isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.restrictedIcon}>🚫</Text>
        <Text style={styles.restrictedTitle}>Access Restricted</Text>
        <Text style={styles.restrictedText}>
          This panel is only available to authorized administrators.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin Panel</Text>

      {metrics && (
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.totalUsers}</Text>
            <Text style={styles.metricLabel}>Total Users</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.verifiedUsers}</Text>
            <Text style={styles.metricLabel}>Verified</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.activeSubscriptions}</Text>
            <Text style={styles.metricLabel}>Subscriptions</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.totalContent}</Text>
            <Text style={styles.metricLabel}>Content Items</Text>
          </View>
        </View>
      )}

      {complianceSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compliance Dashboard</Text>
          <View style={styles.complianceRow}>
            <View style={styles.complianceItem}>
              <Text style={styles.complianceValue}>{complianceSummary.totalChecks}</Text>
              <Text style={styles.complianceLabel}>Total Checks</Text>
            </View>
            <View style={styles.complianceItem}>
              <Text
                style={[
                  styles.complianceValue,
                  {
                    color:
                      complianceSummary.passRate >= 90
                        ? '#34C759'
                        : complianceSummary.passRate >= 70
                          ? '#FFD60A'
                          : '#FF3B30',
                  },
                ]}
              >
                {complianceSummary.passRate}%
              </Text>
              <Text style={styles.complianceLabel}>Pass Rate</Text>
            </View>
            <View style={styles.complianceItem}>
              <Text
                style={[
                  styles.complianceValue,
                  {
                    color:
                      complianceSummary.recentFlags > 10 ? '#FF3B30' : '#FFD60A',
                  },
                ]}
              >
                {complianceSummary.recentFlags}
              </Text>
              <Text style={styles.complianceLabel}>Recent Flags</Text>
            </View>
          </View>
        </View>
      )}

      {metrics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Metrics</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricRowLabel}>Daily Active Users</Text>
            <Text style={styles.metricRowValue}>{metrics.dailyActiveUsers}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricRowLabel}>Verification Rate</Text>
            <Text style={styles.metricRowValue}>
              {metrics.totalUsers > 0
                ? `${((metrics.verifiedUsers / metrics.totalUsers) * 100).toFixed(1)}%`
                : '0%'}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricRowLabel}>Subscription Rate</Text>
            <Text style={styles.metricRowValue}>
              {metrics.totalUsers > 0
                ? `${((metrics.activeSubscriptions / metrics.totalUsers) * 100).toFixed(1)}%`
                : '0%'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Search</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by wallet, name, or email..."
            placeholderTextColor="#636366"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
        {searching ? (
          <ActivityIndicator color="#007AFF" style={{ marginTop: 12 }} />
        ) : (
          searchResults.map((profile) => (
            <View key={profile.id} style={styles.userCard}>
              <Text style={styles.userName}>{profile.displayName}</Text>
              <Text style={styles.userWallet}>{profile.walletAddress}</Text>
              <View style={styles.userTags}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{profile.membershipTier}</Text>
                </View>
                {profile.isVerified && (
                  <View style={[styles.tag, styles.tagVerified]}>
                    <Text style={[styles.tagText, { color: '#34C759' }]}>Verified</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  restrictedIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  restrictedText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    margin: '1%',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metricLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  complianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  complianceItem: {
    alignItems: 'center',
  },
  complianceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  complianceLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  metricRowLabel: {
    fontSize: 15,
    color: '#8E8E93',
  },
  metricRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userWallet: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  userTags: {
    flexDirection: 'row',
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#3A3A3C',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  tagVerified: {
    backgroundColor: '#34C75920',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#AEAEB2',
  },
});
