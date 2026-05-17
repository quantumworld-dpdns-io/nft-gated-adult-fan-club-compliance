import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useAuth } from '../services/auth';
import { profileApi } from '../services/api';
import { ComplianceAuditEntry } from '../services/api';
import { MemberCard } from '../components/MemberCard';
import { NFTBadge } from '../components/NFTBadge';

const tierConfig: Record<string, { color: string; label: string }> = {
  Basic: { color: '#8E8E93', label: 'Free Tier' },
  Premium: { color: '#FFD60A', label: 'Premium' },
  Exclusive: { color: '#FF375F', label: 'Exclusive' },
  Admin: { color: '#007AFF', label: 'Admin' },
};

export function ProfileScreen() {
  const { user, logout, updateProfile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [auditLog, setAuditLog] = useState<ComplianceAuditEntry[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      loadAuditLog();
    }
  }, [user]);

  async function loadAuditLog() {
    try {
      const log = await profileApi.getComplianceLog();
      setAuditLog(log.slice(0, 10));
    } catch {}
  }

  async function handleSaveName() {
    try {
      await updateProfile({ displayName });
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    }
  }

  async function handleLogout() {
    Alert.alert('Disconnect', 'Are you sure you want to disconnect your wallet?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: logout },
    ]);
  }

  if (!user) return null;

  const tier = tierConfig[user.membershipTier] || tierConfig.Basic;
  const subscriptionLabel =
    user.subscriptionStatus === 'active'
      ? `Active · ${user.subscriptionExpiry ? `Expires ${new Date(user.subscriptionExpiry).toLocaleDateString()}` : ''}`
      : user.subscriptionStatus === 'expired'
        ? 'Expired'
        : 'No active subscription';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MemberCard
        displayName={user.displayName}
        walletAddress={user.walletAddress}
        tier={user.membershipTier}
        tierColor={tier.color}
        subscriptionStatus={user.subscriptionStatus as any}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Membership</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Tier</Text>
          <View style={styles.tierBadge}>
            <NFTBadge tier={user.membershipTier} color={tier.color} size="small" />
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text
            style={[
              styles.value,
              {
                color:
                  user.subscriptionStatus === 'active'
                    ? '#34C759'
                    : user.subscriptionStatus === 'expired'
                      ? '#FF3B30'
                      : '#8E8E93',
              },
            ]}
          >
            {subscriptionLabel}
          </Text>
        </View>
        {user.isVerified && (
          <View style={styles.row}>
            <Text style={styles.label}>Age Verified</Text>
            <Text style={[styles.value, { color: '#34C759' }]}>Yes ✅</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Push Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {auditLog.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compliance Audit Log</Text>
          {auditLog.map((entry) => (
            <View key={entry.id} style={styles.auditItem}>
              <View style={styles.auditHeader}>
                <Text style={styles.auditAction}>{entry.action}</Text>
                <View
                  style={[
                    styles.auditStatus,
                    {
                      backgroundColor:
                        entry.status === 'passed'
                          ? '#34C75920'
                          : entry.status === 'failed'
                            ? '#FF3B3020'
                            : '#FFD60A20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.auditStatusText,
                      {
                        color:
                          entry.status === 'passed'
                            ? '#34C759'
                            : entry.status === 'failed'
                              ? '#FF3B30'
                              : '#FFD60A',
                      },
                    ]}
                  >
                    {entry.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.auditDetails}>{entry.details}</Text>
              <Text style={styles.auditTime}>
                {new Date(entry.timestamp).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Disconnect Wallet</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  label: {
    fontSize: 15,
    color: '#8E8E93',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  tierBadge: {
    alignItems: 'flex-end',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  settingLabel: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  auditItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  auditAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  auditStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  auditStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  auditDetails: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  auditTime: {
    fontSize: 11,
    color: '#636366',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
