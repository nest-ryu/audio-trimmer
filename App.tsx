import React, { useState, useCallback, useRef } from 'react';
import { ProcessedFile, FileStatus } from './types';
import { FileItem } from './components/FileItem';
import { UploadIcon, ArchiveIcon } from './components/Icons';

// TypeScript declarations for libraries loaded from CDN
declare var lamejs: any;
declare var JSZip: any;

const App: React.FC = () => {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [trimDuration, setTrimDuration] = useState<number>(5);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // FIX: Explicitly type 'file' as File to resolve 'unknown' type error on properties like 'type', 'name', and 'lastModified'.
      const newFiles = Array.from(event.target.files)
        .filter((file: File) => file.type === 'audio/mpeg')
        .map((file: File) => ({
          id: `${file.name}-${file.lastModified}`,
          originalFile: file,
          status: FileStatus.IDLE,
        }));
      setFiles(prevFiles => [...prevFiles, ...newFiles.filter(nf => !prevFiles.some(pf => pf.id === nf.id))]);
    }
  };

  const updateFileStatus = (id: string, status: FileStatus, data?: Partial<ProcessedFile>) => {
    setFiles(prevFiles =>
      prevFiles.map(f => (f.id === id ? { ...f, status, ...data } : f))
    );
  };

  const handleTrim = async () => {
    if (trimDuration <= 0) {
      alert("잘라낼 시간은 0보다 커야 합니다.");
      return;
    }
    setIsProcessing(true);

    // FIX: Add a type cast to 'any' to allow 'webkitAudioContext' for older browser compatibility, resolving the property not existing on 'Window'.
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    for (const file of files) {
      if (file.status !== FileStatus.IDLE) continue;

      try {
        updateFileStatus(file.id, FileStatus.PROCESSING);
        const arrayBuffer = await file.originalFile.arrayBuffer();
        const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const { sampleRate, numberOfChannels, length } = originalBuffer;
        const startOffset = Math.floor(trimDuration * sampleRate);

        if (startOffset >= length) {
          throw new Error("잘라낼 시간이 오디오 길이보다 깁니다.");
        }

        const newLength = length - startOffset;
        const trimmedBuffer = audioCtx.createBuffer(numberOfChannels, newLength, sampleRate);

        for (let i = 0; i < numberOfChannels; i++) {
          const channelData = originalBuffer.getChannelData(i);
          trimmedBuffer.getChannelData(i).set(channelData.subarray(startOffset));
        }

        // Encode to MP3 using lamejs
        const mp3encoder = new lamejs.Mp3Encoder(numberOfChannels, sampleRate, 128); // 128kbps
        const mp3Data = [];

        const pcm_l = trimmedBuffer.getChannelData(0);
        // Convert Float32Array to Int16Array
        const data_l = new Int16Array(pcm_l.length);
        for(let i = 0; i < pcm_l.length; i++) {
            data_l[i] = pcm_l[i] * 32767.5 - 0.5;
        }

        let pcm_r, data_r;
        if(numberOfChannels === 2) {
            pcm_r = trimmedBuffer.getChannelData(1);
            data_r = new Int16Array(pcm_r.length);
            for(let i = 0; i < pcm_r.length; i++) {
                data_r[i] = pcm_r[i] * 32767.5 - 0.5;
            }
        }
        
        const blockSize = 1152;
        for (let i = 0; i < data_l.length; i += blockSize) {
            const leftChunk = data_l.subarray(i, i + blockSize);
            let rightChunk = null;
            if(numberOfChannels === 2 && data_r) {
                rightChunk = data_r.subarray(i, i + blockSize);
            }
            const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        const blob = new Blob(mp3Data.map(b => new Uint8Array(b)), { type: 'audio/mpeg' });
        updateFileStatus(file.id, FileStatus.DONE, { trimmedBlob: blob });

      } catch (error: any) {
        console.error("Error processing file:", file.originalFile.name, error);
        updateFileStatus(file.id, FileStatus.ERROR, { errorMessage: error.message || '알 수 없는 오류 발생' });
      }
    }

    setIsProcessing(false);
  };
  
  const handleDownload = useCallback((file: ProcessedFile) => {
    if (file.trimmedBlob) {
      const url = URL.createObjectURL(file.trimmedBlob);
      const a = document.createElement('a');
      a.href = url;
      const originalName = file.originalFile.name.replace(/\.mp3$/i, '');
      a.download = `${originalName}_trimmed.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const zip = new JSZip();
    const doneFiles = files.filter(f => f.status === FileStatus.DONE && f.trimmedBlob);
    
    if (doneFiles.length === 0) return;

    doneFiles.forEach(file => {
      const originalName = file.originalFile.name.replace(/\.mp3$/i, '');
      zip.file(`${originalName}_trimmed.mp3`, file.trimmedBlob!);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trimmed_files.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [files]);

  const filesToProcess = files.filter(f => f.status === FileStatus.IDLE).length > 0;
  const processedFiles = files.filter(f => f.status === FileStatus.DONE).length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-2xl mx-auto bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">MP3 시작 부분 일괄 편집기</h1>
          <p className="text-sm text-center text-slate-400 mt-2">여러 MP3 파일의 시작 부분을 원하는 시간만큼 잘라냅니다.</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end p-4 bg-slate-900/50 rounded-lg">
            <div>
              <label htmlFor="trim-duration" className="block text-sm font-medium text-slate-300 mb-1">잘라낼 시간 (초)</label>
              <input
                id="trim-duration"
                type="number"
                value={trimDuration}
                onChange={(e) => setTrimDuration(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                min="0.1"
                step="0.1"
              />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
              disabled={isProcessing}
            >
              <UploadIcon className="w-5 h-5" />
              <span>MP3 파일 선택</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".mp3"
              multiple
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              <ul className="space-y-2">
                {files.map(file => (
                  <FileItem key={file.id} file={file} onDownload={handleDownload} />
                ))}
              </ul>
            </div>
          )}
          {files.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-lg">
                <p className="text-slate-400">파일을 선택하여 시작하세요.</p>
            </div>
          )}
        </div>
        
        {(filesToProcess || processedFiles) && (
            <div className="p-4 bg-slate-900/50 flex flex-col sm:flex-row gap-3">
                 <button
                    onClick={handleTrim}
                    disabled={!filesToProcess || isProcessing}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md font-bold text-lg hover:bg-green-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                    {isProcessing ? '처리 중...' : `변환 시작 (${files.filter(f => f.status === FileStatus.IDLE).length}개)`}
                </button>
                 <button
                    onClick={handleDownloadAll}
                    disabled={!processedFiles || isProcessing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-md font-semibold hover:bg-purple-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                    <ArchiveIcon className="w-5 h-5"/>
                    <span>모두 다운로드 (.zip)</span>
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;
