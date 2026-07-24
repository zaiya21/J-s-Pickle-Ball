import type { Metadata } from "next";
import { getAdminData } from "@/lib/data";
import AdminClient from "@/components/AdminClient";

export const metadata: Metadata = { title: "Admin — J's Pickle Yard" };

export default async function AdminPage() {
  const data = await getAdminData();
  return <AdminClient data={data} />;
}
