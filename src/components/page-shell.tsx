import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Simple centered page with a back link (settings, import pages). */
export function PageShell({
  title,
  description,
  back = "/",
  children,
}: {
  title: string;
  description?: string;
  back?: "/" | "/settings";
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link to={back} />}>
          <ChevronLeftIcon /> Back
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
