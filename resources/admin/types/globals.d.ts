declare const wp: {
  element: {
    createElement: (...args: any[]) => any;
    Fragment: any;
    createRoot: (element: Element) => { render: (node: any) => void };
    useState: <T>(value: T | (() => T)) => [T, (value: T | ((previous: T) => T)) => void];
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
    useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
    useCallback: <T extends (...args: any[]) => any>(callback: T, deps: readonly unknown[]) => T;
    useRef: <T>(value: T) => { current: T };
  };
  components: Record<string, any>;
  data: {
    registerStore: (key: string, config: any) => void;
    select: (key: string) => any;
    dispatch: (key: string) => any;
    useSelect: <T>(mapSelect: (select: (key: string) => any) => T, deps?: readonly unknown[]) => T;
    useDispatch: (key: string) => any;
  };
  apiFetch: any;
  media: any;
  editor?: any;
  i18n: {
    __: (text: string, domain?: string) => string;
    sprintf: (format: string, ...args: any[]) => string;
  };
};

declare interface Window {
  WooptionsFicAdmin: WooptionsFic.AdminBootstrap;
  jQuery?: any;
  wp?: any;
  tinymce?: any;
}

declare namespace JSX {
  interface IntrinsicAttributes { key?: string | number; }
  interface ElementChildrenAttribute { children: {}; }
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}
