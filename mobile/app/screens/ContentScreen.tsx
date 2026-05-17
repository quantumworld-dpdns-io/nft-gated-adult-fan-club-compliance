import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { contentApi, ContentItem } from '../services/api';
import { AgeGateModal } from '../components/AgeGateModal';
import { useAuth } from '../services/auth';

export function ContentScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gateItem, setGateItem] = useState<ContentItem | null>(null);

  const LIMIT = 20;

  useEffect(() => {
    loadContent(1, true);
  }, []);

  async function loadContent(pageNum: number, replace = false) {
    try {
      const result = await contentApi.list(pageNum, LIMIT);
      if (replace) {
        setItems(result.items);
      } else {
        setItems((prev) => [...prev, ...result.items]);
      }
      setTotal(result.total);
      setPage(pageNum);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadContent(1, true);
  }

  function onEndReached() {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    loadContent(page + 1);
  }

  function handleItemPress(item: ContentItem) {
    if (item.isLocked && !user?.isVerified) {
      setGateItem(item);
    } else if (item.isLocked) {
      contentApi.unlock(item.id).then(() => {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isLocked: false } : i))
        );
      });
    } else {
      navigation.navigate('ContentViewer', { contentId: item.id });
    }
  }

  function renderItem({ item }: { item: ContentItem }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.thumbnailContainer}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Text style={styles.placeholderIcon}>
                {item.contentType === 'video' ? '🎥' : item.contentType === 'article' ? '📄' : '🖼️'}
              </Text>
            </View>
          )}
          {item.isLocked && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.tierLabel}>{item.requiredTier}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderFooter() {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color="#007AFF" />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No content available</Text>
          </View>
        }
      />
      <AgeGateModal
        visible={!!gateItem}
        contentTitle={gateItem?.title}
        onClose={() => setGateItem(null)}
        onVerifyAge={() => {
          setGateItem(null);
          navigation.navigate('Verify');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 8,
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    flex: 1,
    margin: 4,
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  thumbnailContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: '#2C2C2E',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 32,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 28,
  },
  cardBody: {
    padding: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  tierLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
