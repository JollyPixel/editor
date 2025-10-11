export type AudioListenerAdapter = {
  getMasterVolume: () => number;
  setMasterVolume: (value: number) => void;
};
