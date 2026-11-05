import { Alert } from 'react-native';

// Browser dialogs on web, native alerts on iOS and Android.

export function confirmAsync(message: string, ok = 'OK', cancel = 'Cancel'): Promise<boolean> {
  if (process.env.EXPO_OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert('', message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

export function notify(message: string): void {
  if (process.env.EXPO_OS === 'web') window.alert(message);
  else Alert.alert('', message);
}
