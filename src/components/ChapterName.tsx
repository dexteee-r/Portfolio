import { Fragment } from "react";

/**
 * A chapter's name, free to wrap after a slash: on a narrow screen
 * "Réparation/Montage" breaks as "Réparation/" then "Montage", never
 * mid-word, and never spills into its neighbour on the desk.
 */
export function ChapterName({ name }: { name: string }) {
  const parts = name.split("/");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
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
