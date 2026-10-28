export type HouseSceneState = {
  progress: number;
  reduced: boolean;
  paused: boolean;
  pointer: [number, number];
  invalidate?: () => void;
};
