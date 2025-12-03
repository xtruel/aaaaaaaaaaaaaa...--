import React, { useState, useEffect } from 'react';
import { Recording } from '../types';
import { X, Video, Music, Trash2, Loader2, Play, Film } from 'lucide-react';
import { blobToWav } from '../services/audioService';

interface GalleryProps {
  recordings: Recording[];
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const Gallery: React.FC<GalleryProps> = ({ recordings, isOpen, onClose, onDelete }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  // Automatically select the newest recording when opened if none selected
  useEffect(() => {
    if (isOpen && recordings.length > 0 && !selectedRecording) {
        setSelectedRecording(recordings[0]);
    }
  }, [isOpen, recordings, selectedRecording]);

  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadVideo = (recording: Recording) => {
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = `recording-${recording.timestamp.getTime()}.${recording.extension}`;
    a.click();
  };

  const downloadAudioWav = async (recording: Recording) => {
    setProcessingId(recording.id);
    try {
        const wavBlob = await blobToWav(recording.blob);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audio-${recording.timestamp.getTime()}.wav`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
        console.error("WAV conversion failed", e);
        alert("Failed to convert audio to WAV.");
    } finally {
        setProcessingId(null);
    }
  };

  const handleDelete = (id: string) => {
      if (selectedRecording?.id === id) {
          setSelectedRecording(null);
      }
      onDelete(id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="bg-blue-600 w-2 h-6 rounded-full"/>
            Media Gallery
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
            
            {/* Left: Main Player Area */}
            <div className="flex-1 bg-black flex flex-col justify-center relative border-r border-zinc-800">
                {selectedRecording ? (
                    <div className="w-full h-full flex flex-col">
                        <video 
                            src={selectedRecording.url} 
                            controls 
                            className="w-full h-full object-contain bg-black"
                            autoPlay
                        />
                        {/* Player Controls / Metadata Bar */}
                        <div className="bg-zinc-900 p-4 border-t border-zinc-800 flex justify-between items-center">
                            <div>
                                <h3 className="font-medium text-white">Recording {selectedRecording.timestamp.toLocaleTimeString()}</h3>
                                <p className="text-xs text-zinc-500">{formatSize(selectedRecording.size)} • {selectedRecording.extension.toUpperCase()}</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                onClick={() => downloadVideo(selectedRecording)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition-colors"
                                >
                                <Video size={16} /> Save Video
                                </button>
                                <button 
                                onClick={() => downloadAudioWav(selectedRecording)}
                                disabled={processingId === selectedRecording.id}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
                                >
                                {processingId === selectedRecording.id ? <Loader2 size={16} className="animate-spin"/> : <Music size={16} />} 
                                Save Audio
                                </button>
                                <button 
                                onClick={() => handleDelete(selectedRecording.id)}
                                className="p-2 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-lg transition-colors"
                                title="Delete"
                                >
                                <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <Film size={48} className="mb-4 opacity-50" />
                        <p>Select a video to play</p>
                    </div>
                )}
            </div>

            {/* Right: Playlist / List */}
            <div className="w-full md:w-80 bg-zinc-900 overflow-y-auto border-l border-zinc-800 shrink-0">
                <div className="p-4 space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Recent Recordings</h3>
                    {recordings.length === 0 ? (
                        <div className="text-center py-8 text-zinc-600 text-sm">
                            No recordings yet.
                        </div>
                    ) : (
                        recordings.map((rec) => (
                        <button 
                            key={rec.id} 
                            onClick={() => setSelectedRecording(rec)}
                            className={`w-full text-left rounded-xl overflow-hidden border transition-all group ${
                                selectedRecording?.id === rec.id 
                                ? 'bg-zinc-800 border-blue-500/50 ring-1 ring-blue-500/50' 
                                : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
                            }`}
                        >
                            <div className="aspect-video bg-black relative">
                                <video src={rec.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                        <Play size={12} className="ml-0.5 text-white" fill="currentColor" />
                                    </div>
                                </div>
                                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                                    {rec.extension}
                                </span>
                            </div>
                            <div className="p-3">
                                <div className="flex justify-between items-start">
                                    <span className="text-sm font-medium text-zinc-200">
                                        {rec.timestamp.toLocaleTimeString()}
                                    </span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(rec.id); }}
                                        className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <span className="text-xs text-zinc-500">{formatSize(rec.size)}</span>
                            </div>
                        </button>
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};