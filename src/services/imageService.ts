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

  const fileExt = compressedFile.name.split('.').pop() || 'jpg';
  const fileName = `${sku.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(filePath, compressedFile, { upsert: true, contentType: compressedFile.type || 'image/jpeg' });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Photo upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}
