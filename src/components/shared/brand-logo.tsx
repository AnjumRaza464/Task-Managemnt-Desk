import Image from "next/image";
import { cn } from "@/lib/utils";

const BRAND_BG = "bg-[#130a12]";

/**
 * UniKyn wordmark (white on transparent), shown on the brand's dark plate so it
 * reads on light and dark themes alike. Height is set by `className` (e.g. h-8).
 */
export function BrandLogo({
  className,
  imgClassName,
  plain = false,
}: {
  className?: string;
  imgClassName?: string;
  /** Skip the dark plate when the logo already sits on a dark surface. */
  plain?: boolean;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-lg", !plain && `px-2 ${BRAND_BG}`, className)}>
      <Image
        src="/unikyn-logo.png"
        alt="UniKyn"
        width={400}
        height={133}
        priority
        className={cn("h-full w-auto object-contain", imgClassName)}
      />
    </span>
  );
}

/** Square "U" mark for tight spots: collapsed sidebar, small headers. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/unikyn-mark.png"
      alt="UniKyn"
      width={256}
      height={256}
      priority
      className={cn("size-8 shrink-0 rounded-lg object-cover", className)}
    />
  );
}
