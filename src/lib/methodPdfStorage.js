import { supabase, isSupabaseConfigured } from './supabase'
import { uuidv4 } from './uuid'

const BUCKET = 'method-pdfs'

function mustSupa() {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
}

function assertPdfFile(file) {
  if (!file) throw new Error('PDF 파일이 필요합니다.')
  const name = String(file.name ?? '').toLowerCase()
  const type = String(file.type ?? '').toLowerCase()
  const isPdf = type === 'application/pdf' || name.endsWith('.pdf')
  if (!isPdf) throw new Error('PDF(.pdf) 파일만 업로드할 수 있습니다.')
  const maxBytes = 25 * 1024 * 1024
  if (Number(file.size) > maxBytes) throw new Error('PDF 용량은 25MB 이하만 지원합니다.')
}

function buildPath({ userId, kind }) {
  const safeKind = kind === 'preview' ? 'preview' : 'full'
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  return `${userId}/${safeKind}/${ts}-${uuidv4()}.pdf`
}

/**
 * PDF 업로드 (method 전략 전용)
 * @param {File} file
 * @param {{ userId: string, kind?: 'full'|'preview' }} opts
 * @returns {Promise<{ path: string }>}
 */
export async function uploadMethodPdf(file, opts) {
  mustSupa()
  assertPdfFile(file)
  const userId = String(opts?.userId ?? '').trim()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const path = buildPath({ userId, kind: opts?.kind })
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: 'application/pdf',
      cacheControl: '3600',
    })
  if (error) throw error
  return { path }
}

/**
 * method PDF 접근 URL (signed)
 * @param {string} path
 * @param {{ expiresIn?: number }} [opts]
 */
export async function getMethodPdfSignedUrl(path, opts) {
  mustSupa()
  const p = String(path ?? '').trim()
  if (!p) return null
  const expiresIn = Number.isFinite(Number(opts?.expiresIn)) ? Number(opts.expiresIn) : 60 * 10
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(p, expiresIn)
  if (error) throw error
  return data?.signedUrl ?? null
}

export const METHOD_PDF_BUCKET = BUCKET

