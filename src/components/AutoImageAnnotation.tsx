import React, { useMemo, useRef, useEffect, useState } from 'react';

interface Detection {
  location: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  keyword: string;
  score: number;
}

interface OpenAIKeyword {
  text: string;
}

interface Props {
  imageUrl: string;
  detections: Detection[];
  openaiKeywords?: string[];
  className?: string;
}

export const AutoImageAnnotation: React.FC<Props> = ({ 
  imageUrl, 
  detections,
  openaiKeywords,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{width: number; height: number; top: number; left: number} | null>(null);
  const [labelSizes, setLabelSizes] = useState<Map<number, {width: number; height: number}>>(new Map());

  // 计算两个矩形的重叠百分比（相对于第一个矩形的面积）
  const calculateOverlapPercentage = (rect1: { left: number; top: number; width: number; height: number }, rect2: { left: number; top: number; width: number; height: number }) => {
    const xOverlap = Math.max(0, Math.min(rect1.left + rect1.width, rect2.left + rect2.width) - Math.max(rect1.left, rect2.left));
    const yOverlap = Math.max(0, Math.min(rect1.top + rect1.height, rect2.top + rect2.height) - Math.max(rect1.top, rect2.top));
    const overlapArea = xOverlap * yOverlap;
    const rect1Area = rect1.width * rect1.height;
    return (overlapArea / rect1Area) * 100;
  };

  // 获取图片实际显示尺寸和位置
  useEffect(() => {
    const updateImageDimensions = () => {
      if (imageRef.current && containerRef.current) {
        const imageRect = imageRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // 计算图片在容器中的实际位置和尺寸
        const imageStyle = window.getComputedStyle(imageRef.current);
        const imageWidth = parseFloat(imageStyle.width);
        const imageHeight = parseFloat(imageStyle.height);
        
        // 计算图片的实际显示区域（考虑 object-contain 的影响）
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const imageAspectRatio = imageWidth / imageHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        let actualWidth, actualHeight, offsetLeft, offsetTop;
        
        if (imageAspectRatio > containerAspectRatio) {
          // 图片较宽，将填满容器宽度
          actualWidth = containerWidth;
          actualHeight = containerWidth / imageAspectRatio;
          offsetLeft = 0;
          offsetTop = (containerHeight - actualHeight) / 2;
        } else {
          // 图片较高，将填满容器高度
          actualHeight = containerHeight;
          actualWidth = containerHeight * imageAspectRatio;
          offsetLeft = (containerWidth - actualWidth) / 2;
          offsetTop = 0;
        }

        const dimensions = {
          width: actualWidth,
          height: actualHeight,
          top: offsetTop,
          left: offsetLeft
        };
        
        console.log('Image actual dimensions:', dimensions);
        setImageDimensions(dimensions);
      }
    };

    // 图片加载完成后立即更新尺寸
    const img = imageRef.current;
    if (img) {
      if (img.complete) {
        updateImageDimensions();
      }
      img.onload = updateImageDimensions;
    }

    // 初始更新
    updateImageDimensions();

    // 监听窗口大小变化
    window.addEventListener('resize', updateImageDimensions);
    return () => window.removeEventListener('resize', updateImageDimensions);
  }, [imageUrl]);

  // 测量标签实际尺寸
  useEffect(() => {
    if (!imageDimensions) {
      console.log('No image dimensions available');
      return;
    }

    const newLabelSizes = new Map<number, {width: number; height: number}>();
    const testDiv = document.createElement('div');
    testDiv.style.position = 'absolute';
    testDiv.style.visibility = 'hidden';
    testDiv.style.fontSize = '1.4rem';
    testDiv.style.lineHeight = '1.6';
    testDiv.style.padding = '0.5rem 1rem';
    testDiv.style.fontWeight = 'bold';
    document.body.appendChild(testDiv);

    // 测量 AWS 检测标签
    detections.forEach((detection, index) => {
      testDiv.textContent = detection.keyword;
      const rect = testDiv.getBoundingClientRect();
      const widthPercent = (rect.width / imageDimensions.width) * 100;
      const heightPercent = (rect.height / imageDimensions.height) * 100;
      newLabelSizes.set(index, { width: widthPercent, height: heightPercent });
      console.log(`Label size for "${detection.keyword}":`, { widthPercent, heightPercent });
    });

    // 测量 OpenAI 关键词标签
    if (openaiKeywords) {
      const startIndex = detections.length;
      openaiKeywords.forEach((keyword, index) => {
        testDiv.textContent = keyword;
        const rect = testDiv.getBoundingClientRect();
        const widthPercent = (rect.width / imageDimensions.width) * 100;
        const heightPercent = (rect.height / imageDimensions.height) * 100;
        newLabelSizes.set(startIndex + index, { width: widthPercent, height: heightPercent });
        console.log(`OpenAI label size for "${keyword}":`, { widthPercent, heightPercent });
      });
    }

    document.body.removeChild(testDiv);
    setLabelSizes(newLabelSizes);
  }, [detections, openaiKeywords, imageDimensions]);

  // 计算标签位置
  const calculateLabelPositions = (detections: Detection[]) => {
    if (!imageDimensions || labelSizes.size === 0) {
      console.log('Cannot calculate positions:', { imageDimensions, labelSizesCount: labelSizes.size });
      return new Map();
    }

    const positions = new Map<number, { left: number; top: number }>();
    const targetOverlap = 50; // 与目标物体的期望重叠百分比
    const maxLabelOverlap = 20; // 标签之间最大允许重叠百分比
    const maxObjectOverlap = 20; // 与其他物体最大允许重叠百分比
    const minMarginPixels = 10; // 与图片边缘的最小像素距离

    // 严格的边界检查函数
    const strictEnsureInBounds = (pos: { left: number; top: number }, labelWidth: number, labelHeight: number) => {
      if (!imageDimensions) return pos;

      const minMarginPixels = 10; // 与图片边缘的最小像素距离
      
      // 将像素边距转换为相对于图片实际尺寸的百分比
      const marginX = (minMarginPixels / imageDimensions.width) * 100;
      const marginY = (minMarginPixels / imageDimensions.height) * 100;
      const safetyMargin = 1; // 1% 的额外安全边距

      // 考虑图片的实际位置和尺寸
      const effectiveLeft = imageDimensions.left / imageDimensions.width * 100;
      const effectiveTop = imageDimensions.top / imageDimensions.height * 100;
      const effectiveWidth = 100 - (2 * effectiveLeft);
      const effectiveHeight = 100 - (2 * effectiveTop);

      // 计算有效的边界范围
      const minLeft = effectiveLeft + marginX + safetyMargin;
      const maxLeft = effectiveLeft + effectiveWidth - labelWidth - marginX - safetyMargin;
      const minTop = effectiveTop + marginY + safetyMargin;
      const maxTop = effectiveTop + effectiveHeight - labelHeight - marginY - safetyMargin;

      // 确保位置在有效范围内
      const left = Math.min(Math.max(minLeft, pos.left), maxLeft);
      const top = Math.min(Math.max(minTop, pos.top), maxTop);

      return { left, top };
    };

    detections.forEach((detection, index) => {
      const labelSize = labelSizes.get(index);
      if (!labelSize) {
        console.log(`No label size for detection ${index}`);
        return;
      }

      const { left, top, width, height } = detection.location;
      const { width: labelWidth, height: labelHeight } = labelSize;

      console.log(`Processing label ${index}:`, { detection, labelSize });

      // 生成候选位置，优化初始位置计算
      const candidatePositions = [
        // 优先考虑右侧位置
        { left: Math.min(left + width, 100 - labelWidth - 2), top }, // 右上，确保不超出右边界
        // 左侧位置
        { left: Math.max(2, left - labelWidth), top }, // 左上，确保不超出左边界
        // 上下位置
        { left: left + (width - labelWidth) / 2, top: Math.max(2, top - labelHeight) }, // 正上方
        { left: left + (width - labelWidth) / 2, top: Math.min(top + height, 100 - labelHeight - 2) }, // 正下方
        // 其他备选位置
        { left: left + width - labelWidth * 0.8, top: top + height }, // 右下
        { left: Math.max(2, left - labelWidth * 0.2), top: top + height }, // 左下
        { left: left + width, top: top + height/2 - labelHeight/2 }, // 正右方
        { left: Math.max(2, left - labelWidth), top: top + height/2 - labelHeight/2 } // 正左方
      ].map(pos => strictEnsureInBounds(pos, labelWidth, labelHeight));

      console.log('Candidate positions:', candidatePositions);

      // 找到最佳位置
      let bestPosition = candidatePositions[0];
      let bestScore = -Infinity;

      candidatePositions.forEach(pos => {
        let score = 0;
        const labelRect = { ...pos, width: labelWidth, height: labelHeight };

        // 检查是否在边界内
        const distanceToEdge = Math.min(
          pos.left,
          100 - (pos.left + labelWidth),
          pos.top,
          100 - (pos.top + labelHeight)
        );
        if (distanceToEdge < 0) {
          return; // 跳过超出边界的位置
        }
        score += distanceToEdge * 2; // 距离边界越远越好

        // 检查与目标物体的重叠
        const targetOverlapPercent = calculateOverlapPercentage(labelRect, detection.location);
        score -= Math.abs(targetOverlapPercent - targetOverlap);

        // 检查与其他物体的重叠
        detections.forEach((otherDetection, otherIndex) => {
          if (otherIndex !== index) {
            const overlapPercent = calculateOverlapPercentage(labelRect, otherDetection.location);
            if (overlapPercent > maxObjectOverlap) {
              score -= 1000;
            }
          }
        });

        // 检查与其他标签的重叠
        positions.forEach((otherPos, otherIndex) => {
          const otherLabelSize = labelSizes.get(otherIndex);
          if (otherLabelSize) {
            const otherLabelRect = { ...otherPos, ...otherLabelSize };
            const overlapPercent = calculateOverlapPercentage(labelRect, otherLabelRect);
            if (overlapPercent > maxLabelOverlap) {
              score -= 1000;
            }
          }
        });

        if (score > bestScore) {
          bestScore = score;
          bestPosition = pos;
        }
      });

      // 最后一次确保位置在边界内
      const finalPosition = strictEnsureInBounds(bestPosition, labelWidth, labelHeight);
      console.log(`Best position for label ${index}:`, finalPosition);
      positions.set(index, finalPosition);
    });

    return positions;
  };

  // 为 OpenAI 关键词生成随机位置
  const generateRandomPosition = (labelWidth: number, labelHeight: number): { left: number; top: number } | null => {
    if (!imageDimensions) return null;
    
    const minMarginPixels = 10; // 与图片边缘的最小像素距离
    const marginX = (minMarginPixels / imageDimensions.width) * 100;
    const marginY = (minMarginPixels / imageDimensions.height) * 100;
    const safetyMargin = 1;
    
    const maxLeft = 100 - labelWidth - marginX - safetyMargin;
    const maxTop = 100 - labelHeight - marginY - safetyMargin;
    
    const left = Math.random() * (maxLeft - marginX - safetyMargin) + marginX + safetyMargin;
    const top = Math.random() * (maxTop - marginY - safetyMargin) + marginY + safetyMargin;
    
    return { left, top };
  };

  // 计算所有标签位置（包括 AWS 和 OpenAI）
  const calculateAllLabelPositions = () => {
    if (!imageDimensions || labelSizes.size === 0) {
      console.log('Cannot calculate positions:', { imageDimensions, labelSizesCount: labelSizes.size });
      return new Map();
    }

    // 先计算 AWS 标签位置
    const positions = calculateLabelPositions(detections);

    // 计算 OpenAI 关键词位置
    if (openaiKeywords && openaiKeywords.length > 0) {
      const startIndex = detections.length;
      openaiKeywords.forEach((keyword, index) => {
        const labelSize = labelSizes.get(startIndex + index);
        if (labelSize) {
          let position: { left: number; top: number } | null = null;
          let attempts = 0;
          const maxAttempts = 10;

          // 尝试找到一个不重叠的位置
          while (attempts < maxAttempts) {
            position = generateRandomPosition(labelSize.width, labelSize.height);
            if (position) {
              // 检查是否与其他标签重叠
              let hasOverlap = false;
              positions.forEach((existingPos, existingIndex) => {
                const existingSize = labelSizes.get(existingIndex);
                if (existingSize) {
                  const overlap = calculateOverlapPercentage(
                    { ...position!, ...labelSize },
                    { ...existingPos, ...existingSize }
                  );
                  if (overlap > 20) {
                    hasOverlap = true;
                  }
                }
              });

              if (!hasOverlap) break;
            }
            attempts++;
          }

          if (position) {
            positions.set(startIndex + index, position);
          }
        }
      });
    }

    return positions;
  };

  const labelPositions = useMemo(() => calculateAllLabelPositions(), [detections, openaiKeywords, imageDimensions, labelSizes]);

  // 添加调试信息
  console.log('Render state:', {
    imageDimensions,
    labelSizes: Array.from(labelSizes.entries()),
    labelPositions: Array.from(labelPositions.entries())
  });

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`} 
      style={{ 
        width: '100%', 
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="分析图片"
        className="w-auto h-auto object-contain"
        style={{ 
          maxHeight: '70vh',
          maxWidth: '100%'
        }}
        onLoad={() => console.log('Image loaded')}
      />
      
      {imageDimensions && (
        <div 
          className="absolute" 
          style={{
            left: `${imageDimensions.left}px`,
            top: `${imageDimensions.top}px`,
            width: `${imageDimensions.width}px`,
            height: `${imageDimensions.height}px`,
            pointerEvents: 'none'
          }}
        >
          {/* 渲染 AWS 检测标签 */}
          {detections.map((detection, index) => {
            const position = labelPositions.get(index);
            if (!position) {
              console.log(`No position for detection ${index}`);
              return null;
            }
            return (
              <div
                key={`aws-${index}`}
                className="absolute"
                style={{
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  zIndex: 10
                }}
              >
                <div 
                  className="inline-block font-bold text-black px-4 py-2 rounded-md whitespace-nowrap"
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 0, 0.7)',
                    backdropFilter: 'blur(2px)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transform: 'translateY(-50%)',
                    fontSize: '1.4rem',
                    lineHeight: '1.6',
                    zIndex: 20 
                  }}
                >
                  {detection.keyword}
                </div>
              </div>
            );
          })}

          {/* 渲染 OpenAI 关键词标签 */}
          {openaiKeywords?.map((keyword, index) => {
            const position = labelPositions.get(detections.length + index);
            if (!position) {
              console.log(`No position for OpenAI keyword ${index}`);
              return null;
            }
            return (
              <div
                key={`openai-${index}`}
                className="absolute"
                style={{
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  zIndex: 10
                }}
              >
                <div 
                  className="inline-block font-bold text-black px-4 py-2 rounded-md whitespace-nowrap"
                  style={{ 
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    backdropFilter: 'blur(2px)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transform: 'translateY(-50%)',
                    fontSize: '1.4rem',
                    lineHeight: '1.6',
                    zIndex: 20 
                  }}
                >
                  {keyword}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}; 