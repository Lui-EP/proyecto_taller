import { useMemo, useContext } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export default function ScreenContainer({
  children,
  scroll = true,
  contentStyle,
  onRefresh,
  refreshing = false,
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const bottomOffset = useMemo(
    () => spacing.xxxl + Math.max(tabBarHeight || 0, insets.bottom) + spacing.lg,
    [insets.bottom, tabBarHeight]
  );

  const mergedContentStyle = useMemo(
    () => [styles.content, { paddingBottom: bottomOffset }, contentStyle],
    [bottomOffset, contentStyle]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {scroll ? (
        <ScrollView
          style={styles.wrapper}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={mergedContentStyle}
          refreshControl={
            onRefresh
              ? (
                <RefreshControl
                  refreshing={Boolean(refreshing)}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                  progressBackgroundColor={colors.surface}
                />
              )
              : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.wrapper, ...mergedContentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  wrapper: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
});
