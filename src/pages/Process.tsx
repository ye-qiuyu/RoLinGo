import React, { useState } from 'react';
import { AutoImageAnnotation } from '../components/AutoImageAnnotation';
import { analyzeImage } from '../services/visionService';
import { AnalysisResult } from '../types';
import { useNavigate } from 'react-router-dom';

export const Process: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      // 创建图片URL
      const url = URL.createObjectURL(file);
      setImageUrl(url);

      // 将文件转换为base64
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]); // 移除 "data:image/jpeg;base64," 前缀
        };
        reader.readAsDataURL(file);
      });

      // 分析图片
      console.log('开始分析图片...');
      const result = await analyzeImage(base64Image);
      console.log('分析完成:', result);
      console.log('OpenAI关键词:', result.keywords);
      
      // 确保 detection 数组存在
      const detection = result.detection || [];
      
      // 从 keywords 中过滤掉已经在 detection 中的关键词
      const uniqueKeywords = result.keywords.filter(
        keyword => !detection.some(d => d.keyword === keyword)
      );
      
      const formattedResult = {
        description: result.description,
        keywords: uniqueKeywords, // 只包含未在 detection 中出现的关键词
        scene: result.scene,
        detection
      };
      
      console.log('格式化后的结果:', formattedResult);
      setAnalysisResult(formattedResult);
    } catch (error) {
      console.error('图片分析失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-6">
            <label 
              htmlFor="imageUpload"
              className="block w-full p-4 text-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
            >
              {imageUrl ? '重新选择图片' : '选择图片进行分析'}
              <input
                id="imageUpload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isLoading}
              />
            </label>
          </div>

          {isLoading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
              <p className="mt-2 text-gray-600">正在分析图片...</p>
            </div>
          )}

          {imageUrl && analysisResult && (
            <div>
              <div className="mb-6">
                <AutoImageAnnotation 
                  imageUrl={imageUrl} 
                  detections={analysisResult.detection}
                  optimizedKeywords={analysisResult.keywords}
                  className="mb-4"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">场景类型</h3>
                  <p className="text-gray-700">{analysisResult.scene}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">关键词</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.keywords.map((keyword, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">场景描述</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{analysisResult.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 