import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="create-capsule" options={{ presentation: 'modal' }} />
        <Stack.Screen name="capsule/[id]" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
