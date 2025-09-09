"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaseItem, CasesAPI } from "../lib/api";

// Accept both the backend's raw array and the helper's {items: []}
function normalizeCases(res: unknown): CaseItem[] {
  const arr = Array.isArray(res) ? res : (res as any)?.items;
  if (!Array.isArray(arr)) return [];

  // Map backend StudentCase -> frontend CaseItem
  return arr.map((c: any) => {
    // backend returns status as 'QUEUED' | 'IN_PROGRESS' | 'RESOLVED'
    const s = String(c.status || "").toLowerCase() as CaseItem["status"] | undefined;

    return {
      id: c.id,
      status: (s === "queued" || s === "in_progress" || s === "resolved") ? s : "queued",
      createdAt: c.createdAt ?? new Date().toISOString(),
      updatedAt: c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
      deviceId: c.deviceId,
      staffId: c.staffId,
      // put studentName/category into payload so existing components show them
      payload: {
        studentName: c.studentName ?? c?.payload?.studentName,
        category: c.category ?? c?.payload?.category,
      },
    } as CaseItem;
  });
}

export default function useQueue(userId?: string) {
  const [queued, setQueued] = useState<CaseItem[] | null>(null);
  const [inProgress, setInProgress] = useState<CaseItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get raw responses
      const [qRaw, ipRaw] = await Promise.all([
        // @ts-ignore – we want the raw shape back to normalize ourselves
        CasesAPI.list("queued") as unknown as Promise<any>,
        // @ts-ignore
        CasesAPI.list("in_progress") as unknown as Promise<any>,
      ]);

      setQueued(normalizeCases(qRaw));
      setInProgress(normalizeCases(ipRaw));
    } catch (e: any) {
      console.error("Queue load failed:", e);
      setError(e?.message ?? "Failed to load queue");
      // keep previous data if any
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const myActive = useMemo(
    () => (inProgress ?? []).filter((c) => !userId || c.staffId === userId),
    [inProgress, userId]
  );

  async function take(id: string) {
    try { await CasesAPI.take(id); await load(); }
    catch (e: any) { setError(e?.message ?? "Failed to take case"); }
  }
  async function takeNext() {
    try { await CasesAPI.takeNext(); await load(); }
    catch (e: any) { setError(e?.message ?? "Failed to take next case"); }
  }
  async function resolve(id: string) {
    try { 
      await CasesAPI.resolve(id); 
      await load(); 
    }
    catch (e: any) { 
      setError(e?.message ?? "Failed to resolve case"); 
    }
  }

  return { queued, myActive, loading, error, take, takeNext, resolve, reload: load };
}