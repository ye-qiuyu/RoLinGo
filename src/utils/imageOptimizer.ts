export const isImageValid = (file: File): boolean => {
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return false;
  }

  // 检查文件大小（20MB）
  const maxSize = 20 * 1024 * 1024; // 20MB in bytes
  if (file.size > maxSize) {
    return false;
  }

  return true;
};

export const optimizeImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置最大尺寸
        const maxWidth = 1920;
        const maxHeight = 1920;
        let width = img.width;
        let height = img.height;

        // 如果图片超过最大尺寸，按比例缩小
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        // 绘制图片
        ctx?.drawImage(img, 0, 0, width, height);

        // 转换为 base64，使用较高的质量以保持图片清晰度
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(optimizedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
}; 