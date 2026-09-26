import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

interface SiteLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /**
   * A plain anchor: a full page load, no prefetch. For pages outside the app's
   * root layout (the global 404), where every navigation is a full load anyway
   * and prefetching a missing page makes Next answer its RSC request with a 500.
   */
  plain?: boolean;
}

/** An internal link: next/link inside the app, a plain anchor where the app is not mounted. */
export function SiteLink({ href, plain = false, ...props }: SiteLinkProps) {
  return plain ? <a href={href} {...props} /> : <Link href={href} {...props} />;
}
