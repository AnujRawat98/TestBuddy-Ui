import api from './api';

export interface DocumentUploadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  content?: string;
  message?: string;
}

export interface CandidateFromCsv {
  email: string;
  candidateName: string;
  phoneNumber: string;
  whatsAppNumber: string;
  rowNumber: number;
}

export interface SupportedTypes {
  jobDescription: {
    extensions: string[];
    maxSizeMB: number;
    description: string;
  };
  companyPolicy: {
    extensions: string[];
    maxSizeMB: number;
    description: string;
  };
  candidateResume: {
    extensions: string[];
    maxSizeMB: number;
    description: string;
  };
  candidateBulkUpload: {
    extensions: string[];
    maxSizeMB: number;
    description: string;
    csvFormat: {
      required: string[];
      optional: string[];
      example: string;
    };
  };
}

export const DocumentType = {
  JobDescription: 1,
  CompanyPolicy: 2,
  CandidateResume: 3,
  CandidateBulkUpload: 4
} as const;

export type DocumentTypeValue = number;

const documentService = {
  async uploadDocument(
    file: File,
    documentType: DocumentTypeValue
  ): Promise<DocumentUploadResult> {
    const base64 = await fileToBase64(file);
    
    const response = await api.post('/documents/upload', {
      fileName: file.name,
      base64Content: base64,
      documentType: documentType
    });
    
    return response.data;
  },

  async uploadJobDescription(file: File): Promise<DocumentUploadResult> {
    return this.uploadDocument(file, DocumentType.JobDescription);
  },

  async uploadCompanyPolicy(file: File): Promise<DocumentUploadResult> {
    return this.uploadDocument(file, DocumentType.CompanyPolicy);
  },

  async uploadCandidateResume(file: File): Promise<DocumentUploadResult> {
    return this.uploadDocument(file, DocumentType.CandidateResume);
  },

  async uploadCandidatesCsv(file: File): Promise<{
    success: boolean;
    totalRows: number;
    candidates: CandidateFromCsv[];
  }> {
    const base64 = await fileToBase64(file);
    
    const response = await api.post('/documents/parse-csv', {
      base64Content: base64
    });
    
    return response.data;
  },

  async getDocumentContent(filePath: string): Promise<string | null> {
    try {
      const response = await api.get('/documents/content', {
        params: { filePath }
      });
      return response.data.content || null;
    } catch {
      return null;
    }
  },

  async downloadDocument(filePath: string): Promise<Blob | null> {
    try {
      const response = await api.get('/documents/download', {
        params: { filePath },
        responseType: 'blob'
      });
      return new Blob([response.data]);
    } catch {
      return null;
    }
  },

  async deleteDocument(filePath: string): Promise<boolean> {
    try {
      await api.delete('/documents', {
        params: { filePath }
      });
      return true;
    } catch {
      return false;
    }
  },

  async getSupportedTypes(): Promise<SupportedTypes> {
    const response = await api.get('/documents/supported-types');
    return response.data;
  },

  getAllowedExtensions(documentType: DocumentTypeValue): string[] {
    switch (documentType) {
      case 1: // JobDescription
      case 2: // CompanyPolicy
        return ['.pdf', '.doc', '.docx', '.txt', '.md'];
      case 3: // CandidateResume
        return ['.pdf', '.doc', '.docx', '.txt'];
      case 4: // CandidateBulkUpload
        return ['.csv', '.txt'];
      default:
        return [];
    }
  },

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default documentService;
