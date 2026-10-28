import { Suspense } from "react";
import { requireCaller } from "@/lib/auth/caller";
import { pendingForAdmin } from "@/lib/proposals";
import { AdminTabs } from "./admin-tabs";

async function CountedTabs() {
  const caller = await requireCaller("/admin");
  return <AdminTabs proposals={{ pendingForAdmin: await pendingForAdmin(caller) }} />;
}

export function AdminNav() {
  return (
    <Suspense fallback={<AdminTabs proposals={{ pendingForAdmin: 0 }} />}>
      <CountedTabs />
    </Suspense>
  );
}
