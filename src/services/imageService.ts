import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';

export async function compressProductImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.3, // Maximum 300KB
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/jpeg'
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.warn('Image compression fallback:', error);
    return file;
  }
}

export async function uploadProductImage(file: File, sku: string): Promise<string> {
  const compressedFile = await compressProductImage(file);

  // If Supabase is connected, upload to Supabase Storage bucket
  if (supabase) {
    try {
      const fileExt = compressedFile.name.split('.').pop() || 'jpg';
      const fileName = `${sku.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, { upsert: true });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.warn('Falling back to local data URL image storage:', err);
    }
  }

  // Fallback: Convert to Base64 Data URL for local storage
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(compressedFile);
  });
}
