import { notFound } from "next/navigation";
import { UniProjectApp } from "@/components/uniproject/app-shell";
import { pathToView } from "@/components/uniproject/routes";

// Deep links into the single-page app (/projects/<slug>, /u/<name>, /admin/…).
// Anything that isn't a page of the app is a real 404.
export default async function AppPath({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, sp] = await Promise.all([params, searchParams]);
  const view = pathToView(path, (k) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  });
  if (!view) notFound();
  return <UniProjectApp initial={view} />;
}
