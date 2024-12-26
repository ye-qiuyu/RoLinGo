import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import ImageProcess from './pages/ImageProcess';
import BottomNav from './components/Layout/BottomNav';
import './App.css';

const AppContent = () => {
  const location = useLocation();
  const showBottomNav = location.pathname !== '/process';

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className={`flex-1 overflow-auto ${showBottomNav ? 'pb-16' : ''}`}>
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
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
