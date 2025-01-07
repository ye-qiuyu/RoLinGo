import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ImageProcess from './pages/ImageProcess';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/process" element={<ImageProcess />} />
      <Route 
        path="/profile" 
        element={
          <div className="p-4">
            Profile Page (Coming Soon)
          </div>
        } 
      />
    </Routes>
  );
};

export default AppRoutes; 