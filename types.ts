
export enum FileStatus {
  IDLE = '대기',
  PROCESSING = '처리 중',
  DONE = '완료',
  ERROR = '오류',
}

export interface ProcessedFile {
  id: string;
  originalFile: File;
  trimmedBlob?: Blob;
  status: FileStatus;
  errorMessage?: string;
}
