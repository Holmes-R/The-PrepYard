import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="py-16">
      <h1 className="text-4xl font-bold">This path is still uncharted.</h1>
      <p className="my-6 text-muted-foreground">We could not find that page.</p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </section>
  );
}
