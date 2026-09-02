import { Redirect } from "expo-router";

export default function Index() {
  // Temporary redirect to auth until auth flow logic is implemented
  return <Redirect href="/(auth)/login" />;
}
