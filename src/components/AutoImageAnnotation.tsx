import React, { useMemo, useRef, useEffect, useState } from 'react';
import { translationService } from '../services/translationService';
import { VisionAnalysisResult } from '../types';

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
  analysisResult?: VisionAnalysisResult;
  className?: string;
}

export const AutoImageAnnotation: React.FC<Props> = ({ 
  imageUrl, 
  detections,
  openaiKeywords,
  analysisResult,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{width: number; height: number; top: number; left: number} | null>(null);
  const [labelSizes, setLabelSizes] = useState<Map<number, {width: number; height: number}>>(new Map());
  const [positions, setPositions] = useState<Map<number, { left: number; top: number }>>(new Map());
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [flippedLabels, setFlippedLabels] = useState<Set<number>>(new Set());
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const labelStartPos = useRef<{ left: number; top: number } | null>(null);
  const dragStartTime = useRef<number>(0);
  const flipTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [isReading, setIsReading] = useState<boolean>(false);
  const [readingLabel, setReadingLabel] = useState<number | null>(null);
  const clickCountRef = useRef<number>(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

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
          top: imageRect.top - containerRect.top,
          left: imageRect.left - containerRect.left
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
      const heightPercent = (rect.height * 2 / imageDimensions.height) * 100;
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
        const heightPercent = (rect.height * 2 / imageDimensions.height) * 100;
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
    
    const minMarginPixels = 10;
    const marginX = (minMarginPixels / imageDimensions.width) * 100;
    const marginY = (minMarginPixels / imageDimensions.height) * 100;
    
    const minLeft = marginX;
    const maxLeft = 100 - labelWidth - marginX;
    const minTop = marginY + (labelHeight / 4);
    const maxTop = 100 - (labelHeight / 4) - marginY;
    
    const left = Math.random() * (maxLeft - minLeft) + minLeft;
    const top = Math.random() * (maxTop - minTop) + minTop;
    
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

  // 初始化标签位置
  useEffect(() => {
    if (imageDimensions && labelSizes.size > 0) {
      const initialPositions = calculateAllLabelPositions();
      setPositions(initialPositions);
    }
  }, [detections, openaiKeywords, imageDimensions, labelSizes]);

  // 添加调试信息
  console.log('Render state:', {
    imageDimensions,
    labelSizes: Array.from(labelSizes.entries()),
    labelPositions: Array.from(positions.entries())
  });

  // 处理拖拽开始
  const handleDragStart = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    dragStartTime.current = Date.now();
    const position = positions.get(index);
    if (!position || !containerRef.current || !imageDimensions) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    
    dragStartPos.current = {
      x: event.clientX - containerRect.left - imageDimensions.left,
      y: event.clientY - containerRect.top - imageDimensions.top
    };
    labelStartPos.current = { ...position };
    setIsDragging(index);
  };

  // 处理拖拽过程
  const handleDrag = (event: MouseEvent) => {
    if (isDragging === null || !dragStartPos.current || !labelStartPos.current || !imageDimensions) return;

    const labelSize = labelSizes.get(isDragging);
    if (!labelSize) return;

    // 获取容器的位置
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // 计算鼠标相对于图片的位置（百分比）
    const mouseX = event.clientX - containerRect.left - imageDimensions.left;
    const mouseY = event.clientY - containerRect.top - imageDimensions.top;
    const deltaX = ((mouseX - dragStartPos.current.x) / imageDimensions.width) * 100;
    const deltaY = ((mouseY - dragStartPos.current.y) / imageDimensions.height) * 100;

    // 计算新位置
    let newLeft = labelStartPos.current.left + deltaX;
    let newTop = labelStartPos.current.top + deltaY;

    // 确保标签不会超出图片边界
    const minMarginPixels = 10;
    const marginX = (minMarginPixels / imageDimensions.width) * 100;
    const marginY = (minMarginPixels / imageDimensions.height) * 100;

    // 计算边界（相对于图片的百分比位置）
    const minLeft = marginX;
    const maxLeft = 100 - labelSize.width - marginX;
    const minTop = marginY + (labelSize.height / 4);
    const maxTop = 100 - (labelSize.height / 4) - marginY;

    // 限制在边界内
    newLeft = Math.min(Math.max(minLeft, newLeft), maxLeft);
    newTop = Math.min(Math.max(minTop, newTop), maxTop);

    // 更新位置
    const newPositions = new Map(positions);
    newPositions.set(isDragging, { left: newLeft, top: newTop });
    setPositions(newPositions);
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setIsDragging(null);
    dragStartPos.current = null;
    labelStartPos.current = null;
  };

  // 添加和移除全局鼠标事件监听器
  useEffect(() => {
    if (isDragging !== null) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  // 添加语音合成功能
  const speakText = (text: string, index: number) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.onstart = () => {
      setIsReading(true);
      setReadingLabel(index);
    };
    utterance.onend = () => {
      setIsReading(false);
      setReadingLabel(null);
    };
    window.speechSynthesis.speak(utterance);
  };

  // 处理鼠标点击
  const handleMouseClick = (event: React.MouseEvent, index: number, text: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (isDragging !== null || Date.now() - dragStartTime.current > 200) return;

    clickCountRef.current += 1;

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = setTimeout(() => {
      if (clickCountRef.current === 1) {
        const existingTimer = flipTimersRef.current.get(index);
        if (existingTimer) {
          clearTimeout(existingTimer);
          flipTimersRef.current.delete(index);
        }

        setFlippedLabels(prev => {
          const newFlipped = new Set(prev);
          if (!newFlipped.has(index)) {
            newFlipped.add(index);
            const timer = setTimeout(() => {
              setFlippedLabels(current => {
                const updated = new Set(current);
                updated.delete(index);
                return updated;
              });
              flipTimersRef.current.delete(index);
            }, 1500);
            flipTimersRef.current.set(index, timer);
          }
          return newFlipped;
        });
      } else if (clickCountRef.current === 2) {
        speakText(text, index);
      }

      clickCountRef.current = 0;
    }, 200);
  };

  // 加载翻译
  useEffect(() => {
    if (analysisResult) {
      translationService.translateKeywords(analysisResult)
        .then(translations => {
          setTranslations(translations);
        })
        .catch(error => {
          console.error('加载翻译失败：', error);
        });
    }
  }, [analysisResult]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      flipTimersRef.current.forEach(timer => clearTimeout(timer));
      flipTimersRef.current.clear();
    };
  }, []);

  // 添加关键帧动画样式
  const shakeAnimation = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-2px) rotate(-1deg); }
      75% { transform: translateX(2px) rotate(1deg); }
    }
  `;

  return (
    <>
      <style>{shakeAnimation}</style>
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
              pointerEvents: 'none',
              perspective: '1000px' // 添加3D视角
            }}
          >
            {/* 渲染 AWS 检测标签 */}
            {detections.map((detection, index) => {
              const position = positions.get(index);
              if (!position) return null;
              const isFlipped = flippedLabels.has(index);
              return (
                <div
                  key={`aws-${index}`}
                  className="absolute"
                  style={{
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    zIndex: isDragging === index ? 30 : 10,
                    cursor: 'move',
                    pointerEvents: 'auto',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.4s',
                    transform: isFlipped ? 'rotateY(180deg) translateY(-50%)' : 'translateY(-50%)',
                    transformOrigin: '50% 50%'
                  }}
                  onMouseDown={(e) => handleDragStart(e, index)}
                  onClick={(e) => handleMouseClick(e, index, detection.keyword)}
                >
                  <div 
                    className="inline-block font-bold text-black px-4 py-2 rounded-md whitespace-nowrap backface-hidden"
                    style={{ 
                      backgroundColor: 'rgba(255, 255, 0, 0.7)',
                      backdropFilter: 'blur(2px)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      animation: readingLabel === index ? 'shake 0.5s ease-in-out infinite' : 'none',
                      fontSize: '1.4rem',
                      lineHeight: '1.6',
                      userSelect: 'none',
                      backfaceVisibility: 'hidden',
                      position: 'relative'
                    }}
                  >
                    {detection.keyword}
                  </div>
                  <div 
                    className="inline-block font-bold text-black px-4 py-2 rounded-md whitespace-nowrap absolute backface-hidden"
                    style={{ 
                      backgroundColor: 'rgba(255, 255, 0, 0.7)',
                      backdropFilter: 'blur(2px)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      transform: 'rotateY(180deg)',
                      fontSize: '1.4rem',
                      lineHeight: '1.6',
                      userSelect: 'none',
                      backfaceVisibility: 'hidden',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%'
                    }}
                  >
                    {translations.get(detection.keyword) || detection.keyword}
                  </div>
                </div>
              );
            })}

            {/* 渲染 OpenAI 关键词标签 */}
            {openaiKeywords?.map((keyword, index) => {
              const position = positions.get(detections.length + index);
              if (!position) return null;
              const isFlipped = flippedLabels.has(detections.length + index);
              return (
                <div
                  key={`openai-${index}`}
                  className="absolute"
                  style={{
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    zIndex: isDragging === (detections.length + index) ? 30 : 10,
                    cursor: 'move',
                    pointerEvents: 'auto',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.4s',
                    transform: isFlipped ? 'rotateY(180deg) translateY(-50%)' : 'translateY(-50%)',
                    transformOrigin: '50% 50%'
                  }}
                  onMouseDown={(e) => handleDragStart(e, detections.length + index)}
                  onClick={(e) => handleMouseClick(e, detections.length + index, keyword)}
                >
                  <div 
                    className="inline-block font-bold text-black px-4 py-2 rounded-md whitespace-nowrap backface-hidden"
                    style={{ 
                      backgroundColor: 'rgba(34, 197, 94, 0.7)',
                      backdropFilter: 'blur(2px)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      animation: readingLabel === (detections.length + index) ? 'shake 0.5s ease-in-out infinite' : 'none',
                      fontSize: '1.4rem',
                      lineHeight: '1.6',
                      userSelect: 'none',
                      backfaceVisibility: 'hidden',
                      position: 'relative'
                    }}
                  >
                    {keyword}
                  </div>
                  <div 
                    className="inline-block font-bold text-black px-4 py-2 rounded-md whitespace-nowrap absolute backface-hidden"
                    style={{ 
                      backgroundColor: 'rgba(34, 197, 94, 0.7)',
                      backdropFilter: 'blur(2px)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      transform: 'rotateY(180deg)',
                      fontSize: '1.4rem',
                      lineHeight: '1.6',
                      userSelect: 'none',
                      backfaceVisibility: 'hidden',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%'
                    }}
                  >
                    {translations.get(keyword) || keyword}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}; 