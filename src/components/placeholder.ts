/**
 * next/image's props for a blurred preview drawn at build time (content/media):
 * the preview stands in the image's place until the image loads. Without one,
 * nothing — the frame's own surface colour shows, as before.
 */
export function blurPlaceholder(blur: string | undefined) {
  return blur ? ({ placeholder: "blur", blurDataURL: blur } as const) : {};
}
