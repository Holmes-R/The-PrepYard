import { AuthForm } from "@/components/auth-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <AuthForm next={params.next} />
      {params.error && (
        <p role="alert" className="text-center">
          This confirmation link is invalid or expired. Please request a new
          confirmation email.
        </p>
      )}
    </>
  );
}
