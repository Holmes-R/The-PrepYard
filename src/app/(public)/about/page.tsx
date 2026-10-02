import type { Metadata } from "next";
export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <section className="max-w-3xl py-8">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">
        Our mission
      </p>
      <h1 className="mt-5 text-4xl font-bold">
        Preparation should be open to everyone.
      </h1>
      <p className="mt-6 text-lg leading-8 text-muted-foreground">
        The PrepYard is being built to bring company-wise questions, learning
        patterns, and personal practice into one free workspace.
      </p>
      <p className="mt-5 leading-8 text-muted-foreground">
        Practice questions and learning patterns help you prepare steadily for
        future interviews. Create a free account to access your workspace.
      </p>
      <p className="mt-5 leading-8 text-muted-foreground">
        The current release is a scaffold. The catalogue and progress features
        are planned for the next milestones.
      </p>
    </section>
  );
}
