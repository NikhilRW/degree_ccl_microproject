import type { RpcResult } from "@/domain/contracts";

export class ServiceError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}

interface ClientAuthState {
  generation: number;
  transitioning: boolean;
  invalidated: boolean;
}

function clientAuthState(): ClientAuthState | undefined {
  // Keep state on the browser window, never in a shared SSR module singleton.
  if (typeof window === "undefined") return undefined;
  const clientWindow = window as Window & { __intellimartAuthState?: ClientAuthState };
  return clientWindow.__intellimartAuthState ??= {
    generation: 0, transitioning: false, invalidated: false,
  };
}

export const authGeneration = () => clientAuthState()?.generation;
export const isCurrentAuthGeneration = (generation: number | undefined) =>
  generation === authGeneration();

export function beginAuthTransition(): number | undefined {
  const state = clientAuthState();
  if (!state) return undefined;
  state.transitioning = true;
  state.invalidated = false;
  return ++state.generation;
}

export function finishAuthTransition(generation: number | undefined): boolean {
  const state = clientAuthState();
  if (!state) return true;
  if (state.generation !== generation) return false;
  state.generation++;
  state.transitioning = false;
  state.invalidated = false;
  return true;
}

function invalidateSession(generation: number | undefined) {
  const state = clientAuthState();
  if (!state || state.generation !== generation || state.transitioning || state.invalidated) return;
  state.invalidated = true;
  state.generation++;
  window.dispatchEvent(new CustomEvent("intellimart:signed-out", { detail: state.generation }));
}

export async function unwrap<T>(invoke: () => Promise<RpcResult<T>>, sessionScoped = true): Promise<T> {
  // Capture BEFORE invoking the RPC, including synchronous factory work.
  const generation = authGeneration();
  const response = await invoke();
  if (sessionScoped && (!isCurrentAuthGeneration(generation) || clientAuthState()?.transitioning))
    throw new ServiceError("Your account changed while the request was in progress.", 409, "AUTH_CHANGED");
  if (!response.ok) {
    if (sessionScoped && response.error.status === 401) invalidateSession(generation);
    throw new ServiceError(response.error.message, response.error.status, response.error.code);
  }
  return response.value;
}
