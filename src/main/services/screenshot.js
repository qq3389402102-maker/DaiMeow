const { desktopCapturer } = require('electron');

async function captureScreen() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 480, height: 270 },
    });

    if (!sources.length) {
      throw new Error('No screen sources found');
    }

    const primarySource = sources[0];
    const image = primarySource.thumbnail;

    // Resize to target width (maintains aspect ratio)
    const aspectRatio = image.getAspectRatio();
    let targetWidth = 480;
    let targetHeight = Math.round(targetWidth / aspectRatio);
    const resized = image.resize({ width: targetWidth, height: targetHeight });

    // JPEG compress at quality 65
    const jpegBuffer = resized.toJPEG(65);
    const base64 = jpegBuffer.toString('base64');

    return `data:image/jpeg;base64,${base64}`;
  } catch (err) {
    console.error('Screenshot failed:', err.message);
    throw err;
  }
}

module.exports = { captureScreen };
