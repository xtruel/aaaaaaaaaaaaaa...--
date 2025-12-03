
export interface SelfieSegmentationOptions {
  modelSelection: number; // 0 for general, 1 for landscape
}

export interface SelfieSegmentationResults {
  segmentationMask: ImageBitmap;
  image: ImageBitmap;
}

export interface SelfieSegmentation {
  setOptions: (options: SelfieSegmentationOptions) => void;
  onResults: (callback: (results: SelfieSegmentationResults) => void) => void;
  send: (inputs: { image: HTMLVideoElement }) => Promise<void>;
  close: () => Promise<void>;
}

// Extend Window to include the global MediaPipe class loaded via script tag
declare global {
  interface Window {
    SelfieSegmentation: new (config: { locateFile: (file: string) => string }) => SelfieSegmentation;
  }
}

export enum BackgroundMode {
  NONE = 'NONE',
  IMAGE = 'IMAGE', // AI Generated
  SCREEN = 'SCREEN' // System Audio/Video
}

export interface AppState {
  isRecording: boolean;
  isProcessing: boolean;
  backgroundMode: BackgroundMode;
  generatedImage: string | null; // Base64
  systemStream: MediaStream | null;
}

export interface Recording {
  id: string;
  blob: Blob;
  url: string;
  timestamp: Date;
  size: number; // in bytes
  type: string; // mime type
  extension: string; // mp4 or webm
}
