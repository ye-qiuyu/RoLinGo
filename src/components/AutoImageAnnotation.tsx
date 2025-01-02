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

interface Props {
  imageUrl: string;
  detections: Detection[];
  className?: string;
}

export const AutoImageAnnotation: React.FC<Props> = ({ 
  imageUrl, 
  detections,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{width: number; height: number; top: number} | null>(null);
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
        const dimensions = {
          width: imageRect.width,
          height: imageRect.height,
          top: imageRect.top - containerRect.top
        };
        console.log('Image dimensions updated:', dimensions);
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
    testDiv.style.fontSize = '1.1rem';
    testDiv.style.lineHeight = '1.4';
    testDiv.style.padding = '0.25rem 0.75rem';
    testDiv.style.fontWeight = 'bold';
    document.body.appendChild(testDiv);

    detections.forEach((detection, index) => {
      testDiv.textContent = detection.keyword;
      const rect = testDiv.getBoundingClientRect();
      const widthPercent = (rect.width / imageDimensions.width) * 100;
      const heightPercent = (rect.height / imageDimensions.height) * 100;
      newLabelSizes.set(index, { width: widthPercent, height: heightPercent });
      console.log(`Label size for "${detection.keyword}":`, { widthPercent, heightPercent });
    });

    document.body.removeChild(testDiv);
    setLabelSizes(newLabelSizes);
  }, [detections, imageDimensions]);

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
      const marginX = (minMarginPixels / imageDimensions.width) * 100;
      const marginY = (minMarginPixels / imageDimensions.height) * 100;
      
      // 确保位置在有效范围内，添加额外的安全边距
      const safetyMargin = 1; // 1% 的额外安全边距
      const maxLeft = 100 - labelWidth - marginX - safetyMargin;
      const maxTop = 100 - labelHeight - marginY - safetyMargin;
      
      const left = Math.min(Math.max(marginX + safetyMargin, pos.left), maxLeft);
      const top = Math.min(Math.max(marginY + safetyMargin, pos.top), maxTop);
      
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

  const labelPositions = useMemo(() => calculateLabelPositions(detections), [detections, imageDimensions, labelSizes]);

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
      style={{ width: '100%', height: '100%' }}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="分析图片"
        className="w-full h-auto object-contain"
        style={{ maxHeight: '70vh' }}
        onLoad={() => console.log('Image loaded')}
      />
      
      {imageDimensions && (
        <div 
          className="absolute" 
          style={{
            left: 0,
            top: imageDimensions.top,
            width: imageDimensions.width,
            height: imageDimensions.height,
            pointerEvents: 'none'
          }}
        >
          {detections.map((detection, index) => {
            const position = labelPositions.get(index);
            if (!position) {
              console.log(`No position for detection ${index}`);
              return null;
            }

            return (
              <div
                key={index}
                className="absolute"
                style={{
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  zIndex: 10
                }}
              >
                <div 
                  className="inline-block font-bold text-black px-3 py-1 rounded-md whitespace-nowrap"
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 0, 0.7)',
                    backdropFilter: 'blur(2px)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transform: 'translateY(-50%)',
                    fontSize: '1.1rem',
                    lineHeight: '1.4',
                    zIndex: 20 
                  }}
                >
                  {detection.keyword}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}; 