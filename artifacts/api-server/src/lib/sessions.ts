import { randomUUID } from "crypto";
import type { FileMetadata, ScanSummary, ProcessResponse, SessionDetails } from "@workspace/api-zod";

export type SessionStatus = "uploading" | "scanning" | "processing" | "complete" | "error";

export interface InternalSession {
  sessionId: string;
  status: SessionStatus;
  totalFiles: number;
  processedFiles: number;
  currentFile: string | null;
  files: FileMetadata[];
  uploadDir: string;
  outputDir: string | null;
  summary: ScanSummary | null;
  processResult: ProcessResponse | null;
  createdAt: Date;
  log: string[];
}

const sessions = new Map<string, InternalSession>();

export function createSession(uploadDir: string): InternalSession {
  const sessionId = randomUUID();
  const session: InternalSession = {
    sessionId,
    status: "uploading",
    totalFiles: 0,
    processedFiles: 0,
    currentFile: null,
    files: [],
    uploadDir,
    outputDir: null,
    summary: null,
    processResult: null,
    createdAt: new Date(),
    log: [],
  };
  sessions.set(sessionId, session);

  setTimeout(() => {
    sessions.delete(sessionId);
  }, 24 * 60 * 60 * 1000);

  return session;
}

export function getSession(sessionId: string): InternalSession | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, updates: Partial<InternalSession>): void {
  const session = sessions.get(sessionId);
  if (session) {
    Object.assign(session, updates);
  }
}

export function toSessionDetails(session: InternalSession): SessionDetails {
  return {
    sessionId: session.sessionId,
    status: session.status,
    totalFiles: session.totalFiles,
    processedFiles: session.processedFiles,
    currentFile: session.currentFile,
    files: session.files,
    summary: session.summary,
    processResult: session.processResult,
  };
}
