import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';

interface CradleGlowEffectProps {
  active: boolean;
  color?: string;
  intensity?: number;
  speed?: number;
  children: React.ReactNode;
}

export default function CradleGlowEffect({
  active,
  color = '#FF9ECD',
  intensity = 0.8,
  speed = 1500,
  children
}: CradleGlowEffectProps) {
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      // 光晕动画
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(intensity, { duration: speed }),
          withTiming(0.2, { duration: speed })
        ),
        -1,
        true
      );

      // 呼吸动画
      glowScale.value = withRepeat(
        withSequence(
          withSpring(1.1, { damping: 10, stiffness: 80 }),
          withSpring(1, { damping: 10, stiffness: 80 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      glowOpacity.value = withTiming(0);
      glowScale.value = withSpring(1);
    }

    return () => {
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
    };
  }, [active, intensity, speed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    shadowOpacity: glowOpacity.value,
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 15,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    elevation: 5,
    borderRadius: 12,
  },
});
