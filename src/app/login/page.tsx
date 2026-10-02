import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
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
          Sign-in could not be completed. Please try again.
        </p>
      )}
    </>
  );
}
