import type { Element, ElementContent } from "hast";
import Image from "next/image";
import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Dimensions } from "@/content/media";

interface ProjectBodyProps {
  markdown: string;
  /** Intrinsic size of every image the text shows, read at build time. */
  images: Record<string, Dimensions>;
}

/** The only child of a paragraph, ignoring whitespace — an image standing alone. */
function soleImage(node: Element | undefined): Element | null {
  const children = (node?.children ?? []).filter(
    (child: ElementContent) => !(child.type === "text" && !child.value.trim()),
  );
  const [only] = children;
  return children.length === 1 && only?.type === "element" && only.tagName === "img" ? only : null;
}

/**
 * A project's long text, rendered on the server: no client JavaScript, the
 * whole reading in the HTML. Raw HTML and unsafe links never reach this far —
 * the content loader rejects them at build time — and are ignored here too.
 */
export function ProjectBody({ markdown, images }: ProjectBodyProps) {
  const components: Components = {
    // The page title is the one h1; a heading written as `#` in the text is a section.
    h1: ({ node: _node, ...props }) => <h2 {...props} />,

    a: ({ node: _node, href = "", children, ...props }) =>
      href.startsWith("/") ? (
        <Link href={href} {...props}>
          {children}
        </Link>
      ) : (
        <a href={href} {...props}>
          {children}
        </a>
      ),

    img: ({ src, alt }) => {
      const size = typeof src === "string" ? images[src] : undefined;
      if (typeof src !== "string" || !size) return null;
      return (
        <Image
          src={src}
          alt={alt ?? ""}
          width={size.width}
          height={size.height}
          sizes="(min-width: 768px) 40rem, 100vw"
          className="h-auto w-full rounded-sm bg-chapter-surface"
        />
      );
    },

    // An image alone in its paragraph is a figure; its markdown title is the caption.
    p: ({ node, children }) => {
      const image = soleImage(node);
      if (!image) return <p>{children}</p>;
      const caption = image.properties?.title;
      return (
        <figure>
          {children}
          {typeof caption === "string" && caption.trim() && <figcaption>{caption}</figcaption>}
        </figure>
      );
    },

    // Wide tables scroll inside their own frame instead of pushing the page sideways.
    table: ({ node: _node, ...props }) => (
      <div className="prose-scroll">
        <table {...props} />
      </div>
    ),
  };

  return (
    <div className="prose">
      <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {markdown}
      </Markdown>
    </div>
  );
}
