import { APP_NAME } from "@/lib/constants";
import { BrandMark } from "@/components/shared/brand-logo";

/** Centered single-column shell for the forgot / reset password pages. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <BrandMark />
            {APP_NAME}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
