const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 — API health check call
export async function checkSystem(): Promise<SystemStatus> {
  const res = await fetch(`${API_URL}/api/health`);
  
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }

  return {
    online: true,
    categories: [],
  };
}