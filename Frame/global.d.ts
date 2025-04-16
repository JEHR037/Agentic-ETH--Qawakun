interface GtagEvent {
  event: string;
  [key: string]: any;
  category?: string;
  action?: string;
  label?: string; 
}

interface Window {
  dataLayer: GtagEvent[];
}
declare global {
  interface Window {
    dataLayer: GtagEvent[];
    gtag: (event: GtagEvent) => void; 
  }
}

export {};
