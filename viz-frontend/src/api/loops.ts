import type { Loop, LoopStats, TokenData } from '../types/loop';

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:9001';

export async function fetchLoops(limit = 100, offset = 0): Promise<Loop[]> {
  const res = await fetch(`${BACKEND_URL}/api/loops?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`Failed to fetch loops: ${res.statusText}`);
  return res.json();
}

export async function fetchLoopDetail(loopIndex: number): Promise<Loop> {
  const res = await fetch(`${BACKEND_URL}/api/loops/${loopIndex}`);
  if (!res.ok) throw new Error(`Failed to fetch loop detail: ${res.statusText}`);
  return res.json();
}

export async function fetchLoopStats(): Promise<LoopStats> {
  const res = await fetch(`${BACKEND_URL}/api/loops/stats`);
  if (!res.ok) throw new Error(`Failed to fetch loop stats: ${res.statusText}`);
  return res.json();
}

export async function fetchTokenData(): Promise<TokenData> {
  const res = await fetch(`${BACKEND_URL}/api/loops/tokens`);
  if (!res.ok) throw new Error(`Failed to fetch token data: ${res.statusText}`);
  return res.json();
}
