
import React from 'react';
import { ProcessedFile, FileStatus } from '../types';
import { DownloadIcon, CheckCircleIcon, AlertCircleIcon, LoaderIcon, MusicIcon } from './Icons';

interface FileItemProps {
  file: ProcessedFile;
  onDownload: (file: ProcessedFile) => void;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const StatusIndicator: React.FC<{ status: FileStatus }> = ({ status }) => {
  switch (status) {
    case FileStatus.PROCESSING:
      return <LoaderIcon className="w-5 h-5 text-blue-400 animate-spin" />;
    case FileStatus.DONE:
      return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
    case FileStatus.ERROR:
      return <AlertCircleIcon className="w-5 h-5 text-red-400" />;
    default:
      return null;
  }
};

export const FileItem: React.FC<FileItemProps> = ({ file, onDownload }) => {
  return (
    <li className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg space-x-4">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <MusicIcon className="w-6 h-6 text-purple-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{file.originalFile.name}</p>
          <p className="text-xs text-slate-400">{formatBytes(file.originalFile.size)} - <span className={`font-semibold ${file.status === FileStatus.DONE ? 'text-green-400' : 'text-slate-400'}`}>{file.status}</span></p>
          {file.status === FileStatus.ERROR && <p className="text-xs text-red-400 truncate">{file.errorMessage}</p>}
        </div>
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0">
        <StatusIndicator status={file.status} />
        {file.status === FileStatus.DONE && file.trimmedBlob && (
          <button
            onClick={() => onDownload(file)}
            className="p-1.5 text-slate-300 hover:text-white bg-slate-600 hover:bg-blue-600 rounded-full transition-colors duration-200"
            aria-label={`Download ${file.originalFile.name}`}
          >
            <DownloadIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  );
};
