import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const showBottomNav = location.pathname !== '/process';

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className={`flex-1 overflow-auto ${showBottomNav ? 'pb-16' : ''}`}>
        {children}
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout; 