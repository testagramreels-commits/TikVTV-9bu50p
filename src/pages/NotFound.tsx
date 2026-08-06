import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Tv, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const location = useLocation();
  const navigate  = useNavigate();

  useEffect(() => {
    console.error('404 — Route not found:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center px-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <Tv className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-white text-6xl font-black mb-2">404</h1>
        <p className="text-white/50 text-lg mb-8">Channel not found</p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-primary/90 transition-colors mx-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </button>
      </div>
    </div>
  );
};

export default NotFound;
