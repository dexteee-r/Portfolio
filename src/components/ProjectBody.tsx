import type { Element, ElementContent } from "hast";
import Image from "next/image";
import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { clipPoster, isClip } from "@/content/markdown";
import type { Dimensions } from "@/content/media";
import { blurPlaceholder } from "./placeholder";

interface ProjectBodyProps {
  markdown: string;
  /** Intrinsic size of every image the text shows, read at build time. */
  images: Record<string, Dimensions>;
}

/** A photo or clip in a text never stands taller than this share of the screen, like the scanned cover. */
const MAX_HEIGHT_VH = 80;

/** Full width, unless that would make it taller than the screen allows: a vertical one narrows instead. */
function fitScreen({ width, height }: Dimensions) {
  const widest = Math.round(((MAX_HEIGHT_VH * width) / height) * 100) / 100;
  return { width: `min(100%, ${widest}vh)` };
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
      if (typeof src === "string" && isClip(src)) {
        // A clip plays only when asked, with its own sound if it has any (a
        // silent one is encoded without an audio track); its poster stands in
        // until then and gives it its size, so the page never shifts.
        const poster = clipPoster(src);
        const size = images[poster];
        if (!size) return null;
        return (
          <video
            src={src}
            poster={poster}
            width={size.width}
            height={size.height}
            aria-label={alt ?? ""}
            controls
            loop
            playsInline
            preload="none"
            style={{
              ...fitScreen(size),
              // The poster's blurred preview, behind it until it loads.
              ...(size.blur && { backgroundImage: `url("${size.blur}")`, backgroundSize: "cover" }),
            }}
            className="block h-auto rounded-sm bg-chapter-surface"
          />
        );
      }
      const size = typeof src === "string" ? images[src] : undefined;
      if (typeof src !== "string" || !size) return null;
      return (
        <Image
          src={src}
          alt={alt ?? ""}
          width={size.width}
          height={size.height}
          sizes="(min-width: 768px) 40rem, 100vw"
          style={fitScreen(size)}
          className="block h-auto rounded-sm bg-chapter-surface"
          {...blurPlaceholder(size.blur)}
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
