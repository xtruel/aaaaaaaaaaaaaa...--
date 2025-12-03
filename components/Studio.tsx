import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ControlPanel } from './ControlPanel';
import { Gallery } from './Gallery';
import { BackgroundMode, SelfieSegmentation, SelfieSegmentationResults, Recording } from '../types';
import { generateBackgroundImage } from '../services/geminiService';
import { Loader2 } from 'lucide-react';

export const Studio: React.FC = () => {
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  
  // Recording & Media Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const selfieSegmentationRef = useRef<SelfieSegmentation | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Audio Graph Refs (The Mixing Console)
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  
  const sysSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sysGainRef = useRef<GainNode | null>(null);
  const sysAnalyserRef = useRef<AnalyserNode | null>(null);
  
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(BackgroundMode.NONE);
  const [generatedBgImage, setGeneratedBgImage] = useState<HTMLImageElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingGenAI, setIsProcessingGenAI] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [systemStream, setSystemStream] = useState<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  
  // Audio Levels & State
  const [micVolume, setMicVolume] = useState(0);
  const [sysVolume, setSysVolume] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSysMuted, setIsSysMuted] = useState(false);
  
  // Database / Gallery State
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // --- Audio System Setup ---
  
  // Initialize Audio Context & Mixing Destination
  useEffect(() => {
    if (!audioContextRef.current) {
        // Create context
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        
        // Create the "Master Output" for the recorder
        const dest = audioContextRef.current.createMediaStreamDestination();
        audioDestinationRef.current = dest;
    }
    return () => {
        audioContextRef.current?.close();
    };
  }, []);

  const ensureAudioContext = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
      }
  };

  // Setup Microphone Audio Path
  useEffect(() => {
      if (webcamStream && audioContextRef.current && audioDestinationRef.current) {
          ensureAudioContext();
          const ctx = audioContextRef.current;
          
          try {
              // 1. Create Source
              if (micSourceRef.current) micSourceRef.current.disconnect();
              const source = ctx.createMediaStreamSource(webcamStream);
              micSourceRef.current = source;

              // 2. Create Gain (Mute/Volume)
              if (!micGainRef.current) micGainRef.current = ctx.createGain();
              
              // 3. Create Analyser (Visualizer)
              if (!micAnalyserRef.current) {
                  micAnalyserRef.current = ctx.createAnalyser();
                  micAnalyserRef.current.fftSize = 256;
              }

              // 4. Connect Graph: Source -> Gain -> Analyser -> Destination(Recorder)
              // We connect Analyser AFTER gain so visualizer shows silence when muted.
              source.connect(micGainRef.current);
              micGainRef.current.connect(micAnalyserRef.current);
              micGainRef.current.connect(audioDestinationRef.current); // Mix into master

          } catch (e) {
              console.error("Error connecting mic audio:", e);
          }
      }
  }, [webcamStream]);

  // Setup System Audio Path
  useEffect(() => {
      if (systemStream && audioContextRef.current && audioDestinationRef.current) {
          ensureAudioContext();
          const ctx = audioContextRef.current;
          
          try {
              // 1. Create Source
              if (sysSourceRef.current) sysSourceRef.current.disconnect();
              const source = ctx.createMediaStreamSource(systemStream);
              sysSourceRef.current = source;

              // 2. Create Gain (Mute/Volume)
              if (!sysGainRef.current) sysGainRef.current = ctx.createGain();
              
              // 3. Create Analyser
              if (!sysAnalyserRef.current) {
                  sysAnalyserRef.current = ctx.createAnalyser();
                  sysAnalyserRef.current.fftSize = 256;
              }

              // 4. Connect Graph: Source -> Gain -> Analyser -> Destination
              source.connect(sysGainRef.current);
              sysGainRef.current.connect(sysAnalyserRef.current);
              sysGainRef.current.connect(audioDestinationRef.current);

          } catch (e) {
              console.error("Error connecting system audio:", e);
          }
      } else {
          // Cleanup if system audio stops
          if (sysSourceRef.current) {
              sysSourceRef.current.disconnect();
              sysSourceRef.current = null;
          }
          setSysVolume(0);
      }
  }, [systemStream]);

  // Handle Muting via GainNodes (Smooth & Reliable)
  useEffect(() => {
      if (micGainRef.current) {
          micGainRef.current.gain.setTargetAtTime(isMicMuted ? 0 : 1, audioContextRef.current?.currentTime || 0, 0.1);
      }
  }, [isMicMuted]);

  useEffect(() => {
      if (sysGainRef.current) {
          sysGainRef.current.gain.setTargetAtTime(isSysMuted ? 0 : 1, audioContextRef.current?.currentTime || 0, 0.1);
      }
  }, [isSysMuted]);


  // --- Video & Logic ---

  // Start Webcam
  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720, frameRate: 30 },
          audio: true 
        });
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          await webcamVideoRef.current.play();
        }
        setWebcamStream(stream);
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setErrorMsg("Could not access camera/microphone.");
      }
    };
    startWebcam();
  }, []);

  const onSegmentationResults = useCallback((results: SelfieSegmentationResults) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // --- 1. Draw MIRRORED Person (Foreground) ---
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    // Draw Person
    ctx.globalCompositeOperation = 'copy'; 
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    // Apply Mask with slight blur for smoother edges
    ctx.globalCompositeOperation = 'destination-in';
    ctx.filter = 'blur(4px)'; 
    ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';

    ctx.restore(); 
    
    // --- 2. Draw Background ---
    ctx.globalCompositeOperation = 'destination-over';
    
    if (backgroundMode === BackgroundMode.IMAGE && generatedBgImage) {
         const scale = Math.max(canvas.width / generatedBgImage.width, canvas.height / generatedBgImage.height);
         const x = (canvas.width / 2) - (generatedBgImage.width / 2) * scale;
         const y = (canvas.height / 2) - (generatedBgImage.height / 2) * scale;
         ctx.drawImage(generatedBgImage, x, y, generatedBgImage.width * scale, generatedBgImage.height * scale);
    } else if (backgroundMode === BackgroundMode.SCREEN && backgroundVideoRef.current) {
        ctx.drawImage(backgroundVideoRef.current, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.globalCompositeOperation = 'source-over';
    
  }, [backgroundMode, generatedBgImage]);

  // Init MediaPipe
  useEffect(() => {
    const initModel = () => {
      if (window.SelfieSegmentation && !selfieSegmentationRef.current) {
        const selfieSegmentation = new window.SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });
        selfieSegmentation.setOptions({ modelSelection: 1 });
        selfieSegmentation.onResults(onSegmentationResults);
        selfieSegmentationRef.current = selfieSegmentation;
      }
    };
    
    const interval = setInterval(() => {
        if (window.SelfieSegmentation) {
            initModel();
            clearInterval(interval);
        }
    }, 100);
    return () => clearInterval(interval);
  }, []); 

  useEffect(() => {
    if (selfieSegmentationRef.current) {
      selfieSegmentationRef.current.onResults(onSegmentationResults);
    }
  }, [onSegmentationResults]);

  // Function to calculate volume from analyser
  const getVolume = (analyser: AnalyserNode) => {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for(let i=0; i<dataArray.length; i++) {
          sum += dataArray[i];
      }
      return sum / dataArray.length; // Approximate average volume level
  };

  // Main Loop
  const tick = useCallback(async () => {
    // 1. Process Video Frame
    if (webcamVideoRef.current && webcamVideoRef.current.readyState === 4 && selfieSegmentationRef.current) {
      await selfieSegmentationRef.current.send({ image: webcamVideoRef.current });
    }
    
    // 2. Process Audio Levels (Visualizer)
    // Note: Because we connected Analyser AFTER GainNode, these volumes respect the mute state.
    if (micAnalyserRef.current) {
        setMicVolume(Math.min(100, getVolume(micAnalyserRef.current) * 2.0)); 
    }
    if (sysAnalyserRef.current) {
        setSysVolume(Math.min(100, getVolume(sysAnalyserRef.current) * 3.5));
    }

    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [tick]);

  const handleSelectScreenShare = async () => {
    ensureAudioContext();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        // Request raw audio to prevent aggressive filtering of music
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2
        } 
      });

      // Strict Audio Check
      if (stream.getAudioTracks().length === 0) {
        setErrorMsg("⚠️ No System Audio Detected! Please select 'Entire Screen' or 'Tab' and check the 'Share Audio' box.");
        // We do not stop the stream here, allowing user to continue if they really want silence.
        setTimeout(() => setErrorMsg(null), 8000);
      }

      setSystemStream(stream);
      setBackgroundMode(BackgroundMode.SCREEN);
      setIsSysMuted(false); 

      if (backgroundVideoRef.current) {
        backgroundVideoRef.current.srcObject = stream;
        backgroundVideoRef.current.play();
      }
      stream.getVideoTracks()[0].onended = () => {
        setBackgroundMode(BackgroundMode.NONE);
        setSystemStream(null);
      };
    } catch (err) { console.error(err); }
  };

  const handleGenerateBackground = async (prompt: string) => {
    setIsProcessingGenAI(true);
    try {
      const base64Image = await generateBackgroundImage(prompt);
      const img = new Image();
      img.src = base64Image;
      img.onload = () => {
        setGeneratedBgImage(img);
        setBackgroundMode(BackgroundMode.IMAGE);
        setIsProcessingGenAI(false);
      };
    } catch (err) {
      setErrorMsg("Gemini Generation Failed");
      setIsProcessingGenAI(false);
    }
  };
  
  const handleClearBackground = () => {
    setBackgroundMode(BackgroundMode.NONE);
    setGeneratedBgImage(null);
  };

  const startRecording = () => {
    ensureAudioContext();
    if (!canvasRef.current || !audioDestinationRef.current) return;
    
    // 1. Get Video Stream (40 FPS)
    const canvasStream = canvasRef.current.captureStream(40);
    const videoTracks = canvasStream.getVideoTracks();
    
    // 2. Get Mixed Audio Track (Mic + System)
    const mixedAudioTracks = audioDestinationRef.current.stream.getAudioTracks();
    
    if (mixedAudioTracks.length === 0) {
        console.warn("No audio tracks in mixed output");
    }

    // 3. Combine into Final Stream
    const finalStream = new MediaStream([...videoTracks, ...mixedAudioTracks]);
    
    // Codec Selection for Windows Compatibility
    let mimeType = 'video/webm;codecs=vp9';
    let fileExtension = 'webm';

    if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
        mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
        fileExtension = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        fileExtension = 'mp4';
    } else {
        mimeType = 'video/webm';
        fileExtension = 'webm';
    }

    const options: MediaRecorderOptions = {
        videoBitsPerSecond: 1500000, // 1.5 Mbps
        mimeType: mimeType
    };

    try {
        const mediaRecorder = new MediaRecorder(finalStream, options);
        
        mediaRecorder.ondataavailable = (e) => { 
            if (e.data.size > 0) chunksRef.current.push(e.data); 
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
          const url = URL.createObjectURL(blob);
          const newRecording: Recording = {
              id: Date.now().toString(),
              blob,
              url,
              timestamp: new Date(),
              size: blob.size,
              type: mediaRecorder.mimeType,
              extension: fileExtension
          };
          
          setRecordings(prev => [newRecording, ...prev]);
          chunksRef.current = [];
          setIsGalleryOpen(true); 
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
    } catch (e) {
        console.error("Recorder Error:", e);
        setErrorMsg("Recording format not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const deleteRecording = (id: string) => {
      setRecordings(prev => {
          const target = prev.find(r => r.id === id);
          if (target) {
              URL.revokeObjectURL(target.url);
          }
          return prev.filter(r => r.id !== id);
      });
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      <video ref={webcamVideoRef} className="hidden" muted playsInline />
      <video ref={backgroundVideoRef} className="hidden" muted playsInline />
      
      <div className="relative shadow-2xl shadow-purple-900/10 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50 aspect-video w-full max-w-7xl max-h-[85vh] mx-4">
         <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain" />
         
         {isProcessingGenAI && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white backdrop-blur-sm z-20">
                <Loader2 className="animate-spin mb-4 text-yellow-500" size={48} />
                <p className="font-light text-2xl tracking-widest uppercase">Creating Background...</p>
            </div>
         )}
         
         {errorMsg && (
            <div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-3 rounded shadow-lg z-30 cursor-pointer flex items-center gap-2 max-w-md animate-in slide-in-from-top-2" onClick={() => setErrorMsg(null)}>
                <span>{errorMsg}</span>
            </div>
         )}
         
         <div className="absolute top-4 right-4 pointer-events-none z-30">
            {isRecording && <div className="flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">REC</div>}
         </div>
      </div>

      <ControlPanel 
        isRecording={isRecording}
        isProcessing={isProcessingGenAI}
        backgroundMode={backgroundMode}
        recordingsCount={recordings.length}
        micVolume={micVolume}
        sysVolume={sysVolume}
        isMicMuted={isMicMuted}
        isSysMuted={isSysMuted}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onGenerateBackground={handleGenerateBackground}
        onSelectScreenShare={handleSelectScreenShare}
        onClearBackground={handleClearBackground}
        onToggleGallery={() => setIsGalleryOpen(true)}
        onToggleMicMute={() => setIsMicMuted(!isMicMuted)}
        onToggleSysMute={() => setIsSysMuted(!isSysMuted)}
      />

      <Gallery 
        recordings={recordings}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onDelete={deleteRecording}
      />
    </div>
  );
};