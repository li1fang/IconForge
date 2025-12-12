import { useSyncExternalStore } from "react";

export type PreviewMap = Record<number, string>;

export interface EditorState {
  materialId: string;
  algo: string;
  previews: PreviewMap;
  pixelData: string[];
}

type StateSelector<T> = (state: EditorState & EditorActions) => T;

type PixelUpdater = string[] | ((prev: string[]) => string[]);

type PreviewUpdater = PreviewMap | ((prev: PreviewMap) => PreviewMap);

interface EditorActions {
  setMaterialId: (id: string) => void;
  setAlgo: (algo: string) => void;
  setPreviews: (updater: PreviewUpdater) => void;
  setPixelData: (updater: PixelUpdater) => void;
}

const BOARD_SIZE = 16 * 16;
const LOCAL_STORAGE_KEY = "iconforge:editor";
const SESSION_STORAGE_KEY = "iconforge:editor:previews";

function createEmptyPixels() {
  return Array(BOARD_SIZE).fill("");
}

function readJSON<T>(storage: Storage | undefined, key: string): Partial<T> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<T>;
  } catch (error) {
    console.warn("Failed to parse persisted state", error);
    return {};
  }
}

function getStorages(): { local?: Storage; session?: Storage } {
  if (typeof window === "undefined") return {};
  return { local: window.localStorage, session: window.sessionStorage };
}

const defaultState: EditorState = {
  materialId: "demo-id",
  algo: "LANCZOS",
  previews: {},
  pixelData: createEmptyPixels(),
};

function restoreState(): EditorState {
  const { local, session } = getStorages();
  const persisted = readJSON<EditorState>(local, LOCAL_STORAGE_KEY);
  const persistedPreviews = readJSON<EditorState>(session, SESSION_STORAGE_KEY);

  return {
    ...defaultState,
    ...persisted,
    previews: persistedPreviews.previews ?? defaultState.previews,
    pixelData: persisted.pixelData?.length === BOARD_SIZE ? persisted.pixelData : defaultState.pixelData,
  };
}

let currentState: EditorState = restoreState();

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function persistState(state: EditorState) {
  const { local, session } = getStorages();
  try {
    local?.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        materialId: state.materialId,
        algo: state.algo,
        pixelData: state.pixelData,
      })
    );
    session?.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        previews: state.previews,
      })
    );
  } catch (error) {
    console.warn("Failed to persist editor state", error);
  }
}

function setState(next: Partial<EditorState>) {
  currentState = { ...currentState, ...next };
  persistState(currentState);
  notify();
}

const actions: EditorActions = {
  setMaterialId: (id) => setState({ materialId: id }),
  setAlgo: (algo) => setState({ algo }),
  setPreviews: (updater) => {
    const nextValue = typeof updater === "function" ? updater(currentState.previews) : updater;
    setState({ previews: nextValue });
  },
  setPixelData: (updater) => {
    const nextValue = typeof updater === "function" ? updater(currentState.pixelData) : updater;
    setState({ pixelData: nextValue.length === BOARD_SIZE ? nextValue : createEmptyPixels() });
  },
};

function getSnapshot() {
  return currentState;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useEditorStore<T = EditorState & EditorActions>(
  selector: StateSelector<T> = (state) => ({ ...state, ...actions }) as unknown as T
): T {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return selector({ ...state, ...actions });
}

export function resetEditorStore() {
  currentState = restoreState();
  notify();
}

export function clearPixelData() {
  setState({ pixelData: createEmptyPixels() });
}
