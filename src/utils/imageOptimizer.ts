export const isImageValid = (file: File): boolean => {
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    console.error('不支持的文件类型:', file.type);
    return false;
  }

  // 检查文件大小（20MB）
  const maxSize = 20 * 1024 * 1024; // 20MB in bytes
  if (file.size > maxSize) {
    console.error('文件太大:', file.size, '字节');
    return false;
  }

  return true;
};

export const optimizeImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log('开始优化图片:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('文件读取结果为空'));
        return;
      }

      console.log('文件读取成功，开始创建图片对象');
      const img = new Image();
      
      img.onload = () => {
        console.log('图片加载成功，原始尺寸:', {
          width: img.width,
          height: img.height
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法创建 Canvas 上下文'));
          return;
        }
        
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
          console.log('调整后的尺寸:', { width, height });
        }

        canvas.width = width;
        canvas.height = height;
        
        try {
          // 绘制图片
          ctx.drawImage(img, 0, 0, width, height);

          // 转换为 base64，���用较高的质量以保持图片清晰度
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          console.log('图片优化完成');
          resolve(optimizedDataUrl);
        } catch (error) {
          console.error('图片处理过程出错:', error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error('图片加载失败:', error);
        reject(new Error('图片加载失败，请确保图片格式正确且未损坏'));
      };

      // 直接设置图片源
      img.src = e.target.result as string;
    };

    reader.onerror = (error) => {
      console.error('文件读取失败:', error);
      reject(new Error('文件读取失败，请重试'));
    };

    reader.readAsDataURL(file);
  });
}; 