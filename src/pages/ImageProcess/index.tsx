import { useNavigate } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import useImageStore from '../../store/imageStore';

const ImageProcess = () => {
  const navigate = useNavigate();
  const imageData = useImageStore((state) => state.imageData);
  const clearImageData = useImageStore((state) => state.clearImageData);

  useEffect(() => {
    console.log('ImageProcess mounted');
    console.log('Image data present:', !!imageData);
    
    if (!imageData) {
      console.log('No image data, redirecting to home');
      navigate('/');
    }
  }, [imageData, navigate]);

  const handleBack = useCallback(() => {
    console.log('Back button clicked');
    clearImageData();
    navigate('/');
  }, [navigate, clearImageData]);

  const roles = [
    { id: 'Robot', name: 'Robot' },
    { id: 'RealPerson', name: 'RealPerson' },
    { id: 'ProProfessor', name: 'ProProfessor' },
    { id: 'SmallTalker', name: 'SmallTalker', active: true },
    { id: 'FunnyBone', name: 'FunnyBone' }
  ];

  if (!imageData) {
    console.log('No image data in render, returning null');
    return null;
  }

  console.log('Rendering ImageProcess component');
  return (
    <div className="min-h-screen bg-white">
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
            <img
              src={imageData}
              alt="uploaded"
              className="w-full h-auto object-contain max-h-[70vh]"
            />
          </div>
        </div>

        {/* 角色选择区域 */}
        <div className="mt-6 flex justify-between items-center px-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`flex flex-col items-center ${
                role.active ? 'text-orange-500' : 'text-gray-400'
              }`}
            >
              <div className={`w-12 h-12 rounded-full ${
                role.active ? 'bg-orange-500' : 'bg-gray-400'
              }`}></div>
              <span className="text-xs mt-2">{role.name}</span>
            </div>
          ))}
        </div>

        {/* 文本显示区域 */}
        <div className="mt-6 bg-orange-100 rounded-lg p-4">
          <p className="text-lg">
            When you <span className="underline font-medium">bring your A-game</span> but your dog decides to <span className="underline font-medium">outshine you</span> with its nose!
          </p>
        </div>

        {/* 底部操作区域 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button className="p-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
            <button className="p-2 bg-gray-200 rounded-lg flex-1 mx-4">
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