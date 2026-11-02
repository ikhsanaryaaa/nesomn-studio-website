import { events } from '@react-three/fiber';

/** Canvas configuration can finish after its DOM ref was cleared on route change. */
export const scenePointerEvents: typeof events = (store) => {
  const manager = events(store);
  return {
    ...manager,
    connect: (target) => {
      if (target) manager.connect?.(target);
    },
  };
};
