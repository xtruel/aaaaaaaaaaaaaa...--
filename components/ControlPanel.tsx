import React, { useState } from 'react';
import { BackgroundMode } from '../types';
import { Wand2, Monitor, Image as ImageIcon, Square, Film, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface ControlPanelProps {
  isRecording: boolean;
  isProcessing: boolean;
  backgroundMode: BackgroundMode;
  recordingsCount: number;
  micVolume: number; // 0 to 100
  sysVolume: number; // 0 to 100
  isMicMuted: boolean;
  isSysMuted: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onGenerateBackground: (prompt: string) => void;
  onSelectScreenShare: () => void;
  onClearBackground: () => void;
  onToggleGallery: () => void;
  onToggleMicMute: () => void;
  onToggleSysMute: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRecording,
  isProcessing,
  backgroundMode,
  recordingsCount,
  micVolume,
  sysVolume,
  isMicMuted,
  isSysMuted,
  onStartRecording,
  onStopRecording,
  onGenerateBackground,
  onSelectScreenShare,
  onClearBackground,
  onToggleGallery,
  onToggleMicMute,
  onToggleSysMute,
}) => {
  const [prompt, setPrompt] = useState('');

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    onGenerateBackground(prompt);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-900/90 border-t border-zinc-800 backdrop-blur-md z-50 flex flex-col md:flex-row items-center justify-between gap-4">
      
      {/* Left: Background Controls */}
      <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
        <div className="flex bg-zinc-800 rounded-lg p-1 mr-2 shrink-0">
          <button
            onClick={onClearBackground}
            className={`p-2 rounded-md transition-colors ${backgroundMode === BackgroundMode.NONE ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            title="No Background"
          >
            <ImageIcon size={20} />
          </button>
          <button
             onClick={onSelectScreenShare}
             className={`p-2 rounded-md transition-colors ${backgroundMode === BackgroundMode.SCREEN ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'}`}
             title="Share Screen (System Audio)"
          >
            <Monitor size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-1 px-2 grow md:grow-0">
          <Wand2 size={18} className="text-yellow-400 shrink-0" />
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Gemini prompt..."
            className="bg-transparent border-none outline-none text-sm text-white placeholder-zinc-500 w-32 md:w-48"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button 
            onClick={handleGenerate}
            disabled={isProcessing || !prompt.trim()}
            className="text-xs bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white px-3 py-1 rounded-md transition-colors font-medium whitespace-nowrap"
          >
            {isProcessing ? 'Gen...' : 'Gen'}
          </button>
        </div>
      </div>

      {/* Center: Audio Mixer / Visualizer */}
      <div className="flex items-center gap-6 bg-zinc-950 px-6 py-2.5 rounded-xl border border-zinc-800 shadow-inner min-w-[280px] justify-center">
        
        {/* Microphone Channel */}
        <div className="flex flex-col gap-1 w-32 group">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold tracking-wider">
                <button 
                  onClick={onToggleMicMute}
                  className={`flex items-center gap-1.5 transition-colors ${isMicMuted ? 'text-red-500 hover:text-red-400' : 'text-zinc-400 hover:text-white'}`}
                  title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMicMuted ? <MicOff size={12} /> : <Mic size={12} className="text-green-500" />} 
                  MICROPHONE
                </button>
            </div>
            <div className="h-2 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-zinc-800 relative">
                {isMicMuted && <div className="absolute inset-0 bg-red-900/20 z-10" />}
                <div 
                    className={`h-full transition-all duration-75 ease-out ${isMicMuted ? 'bg-zinc-700' : 'bg-gradient-to-r from-green-600 to-green-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`}
                    style={{ width: `${isMicMuted ? 0 : Math.min(micVolume, 100)}%` }}
                />
            </div>
        </div>

        <div className="w-px h-8 bg-zinc-800"></div>

        {/* System Audio Channel */}
        <div className="flex flex-col gap-1 w-32 group">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold tracking-wider">
                <button 
                  onClick={onToggleSysMute}
                  className={`flex items-center gap-1.5 transition-colors ${isSysMuted ? 'text-red-500 hover:text-red-400' : 'text-zinc-400 hover:text-white'}`}
                  title={isSysMuted ? "Unmute System Audio" : "Mute System Audio"}
                >
                  {isSysMuted ? <VolumeX size={12} /> : <Volume2 size={12} className="text-blue-500" />} 
                  SYSTEM AUDIO
                </button>
            </div>
            <div className="h-2 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-zinc-800 relative">
                 {isSysMuted && <div className="absolute inset-0 bg-red-900/20 z-10" />}
                <div 
                    className={`h-full transition-all duration-75 ease-out ${isSysMuted ? 'bg-zinc-700' : 'bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                    style={{ width: `${isSysMuted ? 0 : Math.min(sysVolume, 100)}%` }}
                />
            </div>
        </div>
      </div>

      {/* Right: Recording Controls */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={onToggleGallery}
          className="relative p-3 text-zinc-400 hover:text-white transition-colors group"
          title="Open Gallery / Database"
        >
          <Film size={24} />
          {recordingsCount > 0 && (
            <span className="absolute top-1 right-1 bg-blue-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-sm">
              {recordingsCount}
            </span>
          )}
        </button>

        {!isRecording ? (
          <button
            onClick={onStartRecording}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-red-900/20 transition-all hover:scale-105 active:scale-95"
          >
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            REC
          </button>
        ) : (
          <button
            onClick={onStopRecording}
            className="flex items-center gap-2 bg-zinc-200 hover:bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            <Square size={16} fill="currentColor" />
            STOP
          </button>
        )}
      </div>
    </div>
  );
};