import { LoginPanel } from "../../components/LoginPanel";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

function normalizeNextPath(value?: string | string[]) {
  const nextPath = Array.isArray(value) ? value[0] : value;
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/workspace";
  }
  return nextPath;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginPanel nextPath={normalizeNextPath(params?.next)} />;
}
