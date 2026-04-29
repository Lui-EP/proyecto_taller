import * as Haptics from 'expo-haptics';

function safeRun(action) {
  try {
    return action();
  } catch {
    return undefined;
  }
}

export function hapticTap() {
  return safeRun(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticSelection() {
  return safeRun(() => Haptics.selectionAsync());
}

export function hapticSuccess() {
  return safeRun(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticWarning() {
  return safeRun(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function hapticError() {
  return safeRun(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
