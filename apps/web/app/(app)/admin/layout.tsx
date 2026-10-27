import { ForbiddenError } from "@cortex/server-kit";
import { Forbidden } from "@/components/auth/forbidden";
import { requireOrgAdmin } from "@/lib/auth/caller";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  try {
    await requireOrgAdmin("/admin");
  } catch (error) {
    if (error instanceof ForbiddenError) return <Forbidden />;
    throw error;
  }
  return <>{children}</>;
}
