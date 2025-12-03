import React from 'react';
import { Studio } from './components/Studio';

const App: React.FC = () => {
  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden font-sans selection:bg-yellow-500/30">
       <Studio />
    </div>
  );
};

export default App;