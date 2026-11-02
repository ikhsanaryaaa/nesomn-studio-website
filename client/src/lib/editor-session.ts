import { create } from 'zustand';
import { useSceneEditor } from '../stores/scene-editor-store';
import { useScene3DEditor } from '../stores/scene-3d-store';

// A generation also invalidates responses/images started under the previous identity.
export const useEditorSession = create(() => ({
  identity: undefined as string | null | undefined,
  epoch: 0,
}));
export const editorEpoch = () => useEditorSession.getState().epoch;
export function setEditorIdentity(identity: string | null) {
  if (useEditorSession.getState().identity === identity) return;
  useEditorSession.setState((s) => ({ identity, epoch: s.epoch + 1 }));
  useSceneEditor.getState().reset();
  useScene3DEditor.getState().reset();
}
