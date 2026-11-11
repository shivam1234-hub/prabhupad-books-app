// Desktop: the app bar (app/_layout.web.tsx) replaces the phone's bottom tab
// bar, so the tab group simply renders the active page.
import { Slot } from 'expo-router';

export default function TabLayout() {
  return <Slot />;
}
