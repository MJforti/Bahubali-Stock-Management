import imageCompression from 'browser-image-compression';

export async function compressProductImage(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 0.15,
      maxWidthOrHeight: 600,
      useWebWorker: true,
      fileType: 'image/jpeg'
    });
  } catch (error) {
    console.warn('Image compression fallback:', error);
    return file;
  }
}

/** Compresses the photo and returns it as a data URL stored with the product, offline. */
export async function uploadProductImage(file: File, _sku: string): Promise<string> {
  const compressed = await compressProductImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the photo. Please try again.'));
    reader.readAsDataURL(compressed);
  });
}
