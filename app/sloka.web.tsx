// Desktop: a single śloka opens in the Ślokas page's reading pane (list on the
// left, the śloka on the right), so this route forwards there.
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SlokaRoute() {
  const { list, i } = useLocalSearchParams<{ list?: string; i?: string }>();
  return <Redirect href={{ pathname: '/slokas', params: { list: list ?? 'ranked', i: i ?? '0' } }} />;
}
