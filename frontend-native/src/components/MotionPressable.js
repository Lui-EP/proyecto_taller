import { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { hapticTap } from '../lib/haptics';

export default function MotionPressable({
  children,
  style,
  onPress,
  disabled,
  pressedScale = 0.97,
  withHaptic = true,
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      speed: 24,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (event) => {
    if (withHaptic && !disabled) hapticTap();
    if (typeof onPress === 'function') onPress(event);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      onPressIn={() => animateTo(pressedScale)}
      onPressOut={() => animateTo(1)}
      android_ripple={{ color: 'rgba(176,110,44,0.16)', borderless: false }}
      accessibilityRole="button"
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
