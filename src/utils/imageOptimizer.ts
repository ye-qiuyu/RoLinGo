export const isImageValid = (file: File): boolean => {
  // 检查文件大小（20MB）
  const maxSize = 20 * 1024 * 1024; // 20MB in bytes
  if (file.size > maxSize) {
    console.error('文件太大:', file.size, '字节');
    return false;
  }

  return true;
};

// 检查文件是否为 HEIC 格式（通过魔数检测）
async function isHeicFormat(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const view = new Uint8Array(buffer);
    
    // HEIC 文件的魔数特征
    // 'ftyp' 标识符通常在第4-8字节
    const ftypSignature = [0x66, 0x74, 0x79, 0x70]; // 'ftyp' in ASCII
    // HEIC 格式的品牌标识符
    const heicBrands = [
      [0x68, 0x65, 0x69, 0x63], // 'heic'
      [0x68, 0x65, 0x69, 0x78], // 'heix'
      [0x68, 0x65, 0x76, 0x63], // 'hevc'
      [0x68, 0x65, 0x76, 0x78]  // 'hevx'
    ];

    // 检查 'ftyp' 标识符
    let hasFtyp = true;
    for (let i = 4; i < 8; i++) {
      if (view[i] !== ftypSignature[i - 4]) {
        hasFtyp = false;
        break;
      }
    }

    if (!hasFtyp) return false;

    // 检查品牌标识符
    for (const brand of heicBrands) {
      let matches = true;
      for (let i = 8; i < 12; i++) {
        if (view[i] !== brand[i - 8]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }

    return false;
  } catch (error) {
    console.error('检查 HEIC 格式时出错:', error);
    return false;
  }
}

async function convertHeicToJpeg(file: File): Promise<string> {
  try {
    console.log('开始 HEIC 转换，文件信息:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const formData = new FormData();
    formData.append('image', file);

    console.log('发送请求到服务器...');
    const response = await fetch('http://localhost:3000/api/convert-heic', {
      method: 'POST',
      body: formData
    });

    console.log('服务器响应状态:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('服务器返回错误:', errorData);
      throw new Error(errorData.error || '服务器转换失败');
    }

    console.log('开始读取响应数据...');
    const blob = await response.blob();
    console.log('获取到转换后的数据，大小:', blob.size);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('文件读取完成，准备返回 base64 数据');
        resolve(reader.result as string);
      };
      reader.onerror = (error) => {
        console.error('文件读取失败:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    console.error('HEIC转换失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack
    });
    throw new Error('HEIC转换失败: ' + error.message);
  }
}

export const optimizeImage = async (file: File): Promise<string> => {
  try {
    // 检查是否为 HEIC 格式（不仅通过文件类型，还通过魔数检测）
    const isHeic = file.type.toLowerCase() === 'image/heic' || 
                   file.type.toLowerCase() === 'image/heif' ||
                   await isHeicFormat(file);
                   
    if (isHeic) {
      console.log('检测到 HEIC 格式图片，开始转换');
      return await convertHeicToJpeg(file);
    }

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

            // 转换为 base64，用较高的质量以保持图片清晰度
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
  } catch (error) {
    console.error('优化图片时出错:', error);
    throw error;
  }
}; 