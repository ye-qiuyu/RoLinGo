import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import useImageStore from '../../store/imageStore';
import { optimizeImage, isImageValid } from '../../utils/imageOptimizer';

const Home = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setImageData = useImageStore((state) => state.setImageData);
  const [cards] = useState([
    {
      id: 1,
      image: 'https://picsum.photos/300/400',
      text: 'When you bring your A-game but your dog decides to outshine you with its nose!'
    },
    {
      id: 2,
      image: 'https://picsum.photos/300/300',
      text: '示例文本 2'
    },
    {
      id: 3,
      image: 'https://picsum.photos/300/350',
      text: '示例文本 3'
    },
    {
      id: 4,
      image: 'https://picsum.photos/300/280',
      text: '示例文本 4'
    },
    {
      id: 5,
      image: 'https://picsum.photos/300/320',
      text: '示例文本 5'
    },
    {
      id: 6,
      image: 'https://picsum.photos/300/360',
      text: '示例文本 6'
    }
  ]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input change event triggered');
    const file = event.target.files?.[0];
    
    if (!file) {
      console.log('No file selected');
      return;
    }

    // 验证图片
    if (!isImageValid(file)) {
      alert('请选择有效的图片文件（JPG、PNG、GIF、WebP），大小不超过20MB');
      return;
    }

    console.log('File selected:', file.name, 'Size:', Math.round(file.size / 1024), 'KB');
    
    try {
      console.log('Starting image optimization');
      const optimizedImage = await optimizeImage(file);
      console.log('Image optimized');
      
      setImageData(optimizedImage);
      console.log('Image data set in store');
      
      navigate('/process', { replace: true });
      console.log('Navigated to process page');
    } catch (error) {
      console.error('Error processing image:', error);
      alert('图片处理失败，请重试');
    }
  }, [navigate, setImageData]);

  const breakpointColumnsObj = {
    default: 2,
    640: 2,
    320: 1
  };

  return (
    <div>
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-10">
        <div className="flex justify-between items-center h-14 px-4">
          <h1 className="text-xl font-bold">RoLingo</h1>
          <button className="p-2">
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
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="mt-14 px-2 py-2 bg-gray-100">
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="flex w-auto -ml-2"
          columnClassName="pl-2 bg-clip-padding"
        >
          {cards.map((card) => (
            <div
              key={card.id}
              className="bg-white rounded-lg overflow-hidden shadow-sm mb-2"
            >
              <img
                src={card.image}
                alt="card"
                className="w-full h-auto object-cover"
              />
              <div className="p-3">
                <p className="text-gray-800 text-sm">{card.text}</p>
              </div>
            </div>
          ))}
        </Masonry>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
        onChange={handleImageUpload}
      />

      <button 
        onClick={() => {
          console.log('Upload button clicked');
          fileInputRef.current?.click();
        }}
        className="fixed right-4 bottom-20 bg-blue-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-10 hover:bg-blue-600 active:bg-blue-700 transition-colors"
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  );
};

export default Home; 