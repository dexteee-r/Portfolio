import { Fragment } from "react";

/**
 * A chapter's name, free to wrap after a slash: "Réparation/Montage" breaks
 * as "Réparation/" then "Montage", never mid-word — on a phone, and on a wide
 * screen where its title is large. Each part keeps its words whole: automatic
 * hyphenation would otherwise cut "Mon-tage" to fill the first line.
 */
export function ChapterName({ name }: { name: string }) {
  const parts = name.split("/");
  if (parts.length === 1) return name;
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          <span className="hyphens-manual">{part}</span>
          {i < parts.length - 1 && (
            <>
              /<wbr />
            </>
          )}
        </Fragment>
      ))}
    </>
  );
}
