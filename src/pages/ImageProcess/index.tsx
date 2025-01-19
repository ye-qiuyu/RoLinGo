import { useNavigate } from 'react-router-dom';
import { useEffect, useCallback, useState, useRef } from 'react';
import useImageStore from '../../store/imageStore';
import { analyzeImage } from '../../services/visionService';
import { AutoImageAnnotation } from '../../components/AutoImageAnnotation';
import { Role } from '../../types';
import styles from './index.module.css';

interface VisionAnalysisResult {
  description: string;
  keywords: string[];
  scene: string;
  detection?: {
    location: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
    keyword: string;
    score: number;
  }[];
}

interface AnalysisResult extends VisionAnalysisResult {
  detection?: {
    location: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
    keyword: string;
    score: number;
  }[];
}

interface RoleDescription {
  description: string;
  role: Role;
}

const roles: { id: Role; name: string; description: string }[] = [
  { id: 'Robot', name: '机器人', description: '精确的分析系统' },
  { id: 'RealPerson', name: '真人', description: '自然的对话风格' },
  { id: 'ProProfessor', name: '专业教授', description: '专业严谨的表达' },
  { id: 'SmallTalker', name: '闲聊者', description: '轻松活泼的语气' },
  { id: 'FunnyBone', name: '幽默者', description: '诙谐有趣的表达' },
];

const initialRoleDescriptions: Record<Role, string> = {
  Robot: '',
  RealPerson: '',
  ProProfessor: '',
  SmallTalker: '',
  FunnyBone: ''
};

const ImageProcess = () => {
  const navigate = useNavigate();
  const imageData = useImageStore((state) => state.imageData);
  const clearImageData = useImageStore((state) => state.clearImageData);
  const [roleDescriptions, setRoleDescriptions] = useState<Record<Role, string>>(initialRoleDescriptions);
  const [selectedRole, setSelectedRole] = useState<Role>('RealPerson');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);
  const imageDataRef = useRef(imageData);
  const mountedRef = useRef(false);

  // 加载所有角色的描述
  const loadAllRoleDescriptions = async (keywords: string[], scores: number[]) => {
    const descriptions: Record<Role, string> = {} as Record<Role, string>;
    setIsAnalyzing(true);

    try {
      // 并行请求所有角色的描述
      const requests = roles.map(role => 
        fetch('http://localhost:3000/api/switch-role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keywords,
            scores,
            role: role.id,
            imageData  // 添加图片数据
          }),
        }).then(res => res.json())
      );

      const results = await Promise.all(requests);
      
      // 存储所有角色的描述
      roles.forEach((role, index) => {
        descriptions[role.id] = results[index].description || '';
      });

      setRoleDescriptions(descriptions);
    } catch (error) {
      console.error('加载角色描述失败:', error);
      setError('加载角色描述失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 使用 useEffect 追踪 imageData 的变化
  useEffect(() => {
    imageDataRef.current = imageData;
  }, [imageData]);

  useEffect(() => {
    // 如果已经挂载过，直接返回
    if (mountedRef.current) {
      return;
    }
    mountedRef.current = true;

    console.log('ImageProcess mounted');
    console.log('Image data present:', !!imageData);
    
    if (!imageData) {
      console.log('No image data, redirecting to home');
      navigate('/');
      return;
    }

    // 当图片数据存在时，自动开始分析
    const analyzeCurrentImage = async () => {
      // 如果正在处理中，直接返回
      if (isProcessingRef.current) {
        console.log('已有分析任务在进行中，跳过此次分析');
        return;
      }

      try {
        isProcessingRef.current = true;
        setIsAnalyzing(true);
        setError(null);
        console.log('开始分析图片...');
        const result = await analyzeImage(imageData);
        // 确保分析的是当前图片
        if (imageData === imageDataRef.current) {
          console.log('分析完成:', result);
          setAnalysis(result);
          
          // 获取所有角色的描述
          if (result.detection) {
            const keywords = result.detection.map(d => d.keyword);
            const scores = result.detection.map(d => d.score);
            await loadAllRoleDescriptions(keywords, scores);
          }
        } else {
          console.log('图片已更改，丢弃旧的分析结果');
        }
      } catch (err) {
        console.error('图片分析失败:', err);
        const errorMessage = err instanceof Error ? err.message : '图片分析失败';
        setError(`图片处理出错: ${errorMessage}。请尝试使用其他图片或稍后重试。`);
      } finally {
        setIsAnalyzing(false);
        isProcessingRef.current = false;
      }
    };

    analyzeCurrentImage();

    // 清理函数
    return () => {
      isProcessingRef.current = false;
    };
  }, [imageData, navigate]); // 只在组件挂载和 imageData 变化时执行

  const handleBack = useCallback(() => {
    console.log('Back button clicked');
    clearImageData();
    navigate('/');
  }, [navigate, clearImageData]);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    // 直接从缓存中获取描述
    if (roleDescriptions[role]) {
      setAnalysis(prev => prev ? {
        ...prev,
        description: roleDescriptions[role]
      } : null);
    }
  };

  const handleAnalyzeImage = async (role: Role = selectedRole) => {
    setIsAnalyzing(true);
    try {
      // 调用后端API，传入选中的角色
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          role: role,
        }),
      });

      if (!response.ok) {
        throw new Error('分析失败');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (error) {
      console.error('分析出错:', error);
      // 处理错误...
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!imageData) {
    console.log('No image data in render, returning null');
    return null;
  }

  return (
    <div className={styles.container}>
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-10">
        <div className="flex items-center h-14 px-4">
          <button 
            onClick={handleBack}
            className="p-2 -ml-2"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold flex-1 text-center">RoLingo</h1>
          <div className="w-6"></div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <div className="pt-14 px-4">
        {/* 图片显示区域 */}
        <div className="bg-gray-100 rounded-lg overflow-hidden mt-4">
          <div className="relative w-full">
            <AutoImageAnnotation
              imageUrl={imageData}
              detections={analysis?.detection || []}
              openaiKeywords={analysis?.keywords || []}
              analysisResult={analysis || undefined}
              className="max-h-[70vh] object-contain"
            />
          </div>
        </div>

        {/* 分析结果显示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {analysis && (
          <div className="mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold mb-6">{analysis.scene}</p>
            </div>
          </div>
        )}

        {/* 角色选择区域 */}
        <div className={styles.roleSelector}>
          {roles.map((role) => (
            <button
              key={role.id}
              className={`${styles.roleButton} ${selectedRole === role.id ? styles.selected : ''}`}
              onClick={() => handleRoleSelect(role.id)}
              title={role.description}
            >
              <div className={styles.roleCircle} />
              <div className={styles.roleName}>{role.name}</div>
            </button>
          ))}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* 分析结果显示 */}
        {isAnalyzing ? (
          <div className={styles.analyzing}>
            生成中...
          </div>
        ) : analysis ? (
          <div className={styles.result}>
            <p className={styles.description}>{analysis.description}</p>
          </div>
        ) : null}

        {/* 底部操作区域 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button className="p-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
            <button 
              className={`p-2 rounded-lg flex-1 mx-4 ${
                isAnalyzing 
                  ? 'bg-gray-200 text-gray-500' 
                  : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
              }`}
              disabled={isAnalyzing}
            >
              Try it!
            </button>
            <div className="flex space-x-2">
              <button className="p-2">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
              </button>
              <button className="p-2">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
              </button>
              <button className="p-2">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageProcess; 