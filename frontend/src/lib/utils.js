import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const API = "";

export async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = null;
    try { detail = (await res.json()).detail; } catch { /* ignore */ }
    const err = new Error(`POST ${path} failed`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.json();
}

export function fmtMin(mins) {
  const m = Math.max(0, Math.round(mins));
  const hour = Math.floor(m / 60) % 24;
  const min = m % 60;
  const suffix = hour < 12 ? "AM" : "PM";
  let hh = hour % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(min).padStart(2, "0")} ${suffix}`;
}

export function fmtHour(h) {
  const hour = Math.floor(h) % 24;
  const min = Math.round((h - Math.floor(h)) * 60);
  const suffix = hour < 12 ? "AM" : "PM";
  let hh = hour % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(min).padStart(2, "0")} ${suffix}`;
}
