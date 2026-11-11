// Props react-native-web understands on top of React Native's own, used by the
// desktop (*.web.tsx) screens: data-* attributes and mouse hover events.
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    dataSet?: Record<string, string>;
    onMouseEnter?: (e: any) => void;
    onMouseLeave?: (e: any) => void;
    onMouseDown?: (e: any) => void;
  }
  interface TextProps {
    dataSet?: Record<string, string>;
    onMouseEnter?: (e: any) => void;
    onMouseLeave?: (e: any) => void;
  }
}

