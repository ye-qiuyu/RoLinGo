export async function optimizeImage(file: File): Promise<Blob> {
  if (file.type === 'image/heic') {
    return await convertHeicToJpeg(file);
  }
  return file;
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('http://localhost:3000/api/convert-heic', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '服务器转换失败');
    }

    return await response.blob();
  } catch (error: any) {
    console.error('HEIC转换失败:', error);
    throw new Error('HEIC转换失败: ' + error.message);
  }
} 