const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }

  // อ่าน JSON Response เพื่อเช็ค status จริง
  const healthData = await res.json();

  // ดึงข้อมูล Categories เพิ่มเติม
  const catRes = await fetch(`${API_URL}/api/categories`);
  const categories = catRes.ok ? await catRes.json() : [];

  return {
    online: healthData.status === "ok",
    categories,
  };
}