import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { githubOAuthEnabled, serverEnv } from "@/lib/env";

async function LoginFormWithParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  return <LoginForm next={next} githubEnabled={githubOAuthEnabled(serverEnv())} oauthFailed={params.error === "oauth"} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <LoginFormWithParams searchParams={props.searchParams} />
    </Suspense>
  );
}
