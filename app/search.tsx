import { Redirect } from 'expo-router';

// The full search-results page is a desktop screen (app/search.web.tsx). The
// phone searches from its floating search bar, so this route only exists to
// satisfy expo-router's rule that every platform route has a default file.
export default function SearchRoute() {
  return <Redirect href="/library" />;
}
