import { Redirect } from "expo-router";

export default function Index() {
  // Redirect to app flow, which is protected by AuthGuard in its layout
  return <Redirect href="/(app)/(tabs)" />;
}
