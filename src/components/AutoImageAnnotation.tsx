import React from 'react';

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
  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%' }}>
      <img
        src={imageUrl}
        alt="分析图片"
        className="w-full h-auto object-contain"
        style={{ maxHeight: '70vh' }}
      />
      
      {/* 标注层 */}
      <div className="absolute inset-0">
        {detections.map((detection, index) => {
          const { left, top, width, height } = detection.location;
          return (
            <div
              key={index}
              className="absolute"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                zIndex: 10
              }}
            >
              {/* 边框 */}
              <div className="absolute inset-0 border-2 border-red-500 rounded-md" />
              
              {/* 标签 */}
              <div 
                className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 text-sm rounded-md whitespace-nowrap"
                style={{ zIndex: 20 }}
              >
                {detection.keyword} ({Math.round(detection.score * 100)}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 