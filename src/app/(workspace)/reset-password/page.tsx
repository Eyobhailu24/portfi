import { ResetPassword } from "@/workspace/auth/reset-password";
export const metadata = { title: "Reset your password" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) { return <ResetPassword token={(await searchParams).token}/>; }
