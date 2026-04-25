import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

export default function RecentCalls({ calls }) {
  if (!calls || calls.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No recent calls</Text>
        <Text style={styles.emptySubtext}>Your call history will appear here</Text>
      </View>
    );
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const renderItem = ({ item }) => (
    <View style={styles.callItem}>
      <Text style={styles.callIcon}>
        {item.status === 'completed' ? '📞' : item.status === 'failed' ? '❌' : '📤'}
      </Text>
      <View style={styles.callInfo}>
        <Text style={styles.callNumber}>{item.to}</Text>
        <Text style={styles.callTime}>{formatTime(item.timestamp)}</Text>
      </View>
      <Text style={styles.callStatus}>
        {item.duration ? `${item.duration}s` : item.status || 'calling...'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Calls</Text>
      <FlatList
        data={calls.slice(0, 10)}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.timestamp}-${index}`}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  callIcon: {
    fontSize: 20,
  },
  callInfo: {
    flex: 1,
  },
  callNumber: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  callTime: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  callStatus: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 6,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
