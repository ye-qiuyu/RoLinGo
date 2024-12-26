import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import BottomNav from './components/Layout/BottomNav';
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<div className="p-4">Profile Page (Coming Soon)</div>} />
        </Routes>
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
