export function formatIDR(amount: number | string | undefined | null): string {
  const num = Number(amount || 0);
  return "Rp " + num.toLocaleString("id-ID");
}

export function formatTime(iso: string | undefined | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
}

export async function apiJson<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data: unknown = {};
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }

  return { status: res.status, ok: res.ok, data: data as T };
}
