export interface ScreenshotRectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface ScreenshotSize {
  width: number
  height: number
}

export function scaleScreenshotRectangle(
  rect: ScreenshotRectangle,
  content: ScreenshotSize,
  image: ScreenshotSize,
): ScreenshotRectangle {
  if (
    ![rect.x, rect.y, rect.width, rect.height, content.width, content.height, image.width, image.height].every(Number.isFinite)
    || rect.width <= 0
    || rect.height <= 0
    || content.width <= 0
    || content.height <= 0
    || image.width <= 0
    || image.height <= 0
  ) {
    throw new Error('Ungültiger Screenshot-Bereich.')
  }

  const left = Math.max(0, Math.min(content.width, rect.x))
  const top = Math.max(0, Math.min(content.height, rect.y))
  const right = Math.max(left, Math.min(content.width, rect.x + rect.width))
  const bottom = Math.max(top, Math.min(content.height, rect.y + rect.height))
  const x = Math.floor(left * image.width / content.width)
  const y = Math.floor(top * image.height / content.height)
  const width = Math.min(image.width - x, Math.ceil((right - left) * image.width / content.width))
  const height = Math.min(image.height - y, Math.ceil((bottom - top) * image.height / content.height))
  if (width < 1 || height < 1) throw new Error('Bitte einen größeren Screenshot-Bereich auswählen.')
  return { x, y, width, height }
}
