import fs from 'fs';
import path from 'path';

export interface SavedFile {
  filename: string;
  path: string;
  url: string;
}

/**
 * Save base64 data to a file in the screenshots directory
 * @param base64Data Base64 encoded data (without data URL prefix)
 * @param extension File extension (e.g., 'png', 'jpg')
 * @param baseUrl Base URL for the server (e.g., 'http://localhost:3000')
 * @returns Information about the saved file
 */
export function saveBase64ToFile(
  base64Data: string,
  extension: string = 'png',
  baseUrl: string = 'http://localhost:3000'
): SavedFile {
  // Ensure screenshots directory exists
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Generate unique filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${timestamp}.${extension}`;
  const filePath = path.join(screenshotsDir, filename);

  // Remove data URL prefix if present (e.g., "data:image/png;base64,")
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  // Save file
  fs.writeFileSync(filePath, cleanBase64, 'base64');

  return {
    filename,
    path: filePath,
    url: `${baseUrl}/screenshots/${filename}`
  };
}

/**
 * Clean up old screenshot files (older than specified hours)
 * @param maxAgeHours Maximum age of files to keep in hours (default: 24)
 */
export function cleanupOldScreenshots(maxAgeHours: number = 24): void {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    return;
  }

  const maxAge = Date.now() - (maxAgeHours * 60 * 60 * 1000);

  try {
    const files = fs.readdirSync(screenshotsDir);

    for (const file of files) {
      const filePath = path.join(screenshotsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime.getTime() < maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    // Log error to stderr without disrupting operation
    process.stderr.write(`[${new Date().toISOString()}] Screenshot cleanup error: ${error}\n`);
  }
}