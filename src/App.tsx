import { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import Layout from './components/Layout';
import { initializeVocabularyService } from './services/visionService';

function App() {
  useEffect(() => {
    // 初始化词汇服务
    const initializeServices = async () => {
      try {
        console.log('开始初始化词汇服务...');
        await initializeVocabularyService();
        console.log('词汇服务初始化成功');
      } catch (error) {
        console.error('词汇服务初始化失败:', error);
        // 尝试重新初始化
        setTimeout(async () => {
          try {
            console.log('尝试重新初始化词汇服务...');
            await initializeVocabularyService();
            console.log('词汇服务重新初始化成功');
          } catch (retryError) {
            console.error('词汇服务重新初始化失败:', retryError);
          }
        }, 2000);
      }
    };

    initializeServices();
  }, []);

  return (
    <Router>
      <Layout>
        <AppRoutes />
      </Layout>
    </Router>
  );
}

export default App;
