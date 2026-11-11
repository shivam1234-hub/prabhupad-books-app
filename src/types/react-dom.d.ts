// @types/react-dom is not installed (the phone app never imports react-dom);
// the desktop screens only need createPortal.
declare module 'react-dom' {
  export function createPortal(children: any, container: Element): any;
}
