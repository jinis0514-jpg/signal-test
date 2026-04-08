import { isSupabaseConfigured, supabase } from './supabase'

export class SupportInboxError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message)
    this.name = 'SupportInboxError'
    this.code = code
  }
}

function requireSupaAndUser(userId) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new SupportInboxError('DB가 설정되지 않았습니다.', 'NO_SUPABASE')
  }
  if (!userId) {
    throw new SupportInboxError('로그인이 필요합니다.', 'NO_USER')
  }
}

/**
 * @param {{
 *   userId: string,
 *   formType: 'feedback'|'inquiry',
 *   category: string,
 *   title: string,
 *   content: string
 * }} payload
 */
export async function createSupportMessage(payload) {
  const userId = payload?.userId
  requireSupaAndUser(userId)

  const formType = String(payload?.formType ?? '').trim()
  const category = String(payload?.category ?? '').trim()
  const title = String(payload?.title ?? '').trim()
  const content = String(payload?.content ?? '').trim()

  if (!formType || !category || !title || !content) {
    throw new SupportInboxError('카테고리, 제목, 내용을 모두 입력해 주세요.', 'INVALID_INPUT')
  }
  if (title.length > 120) {
    throw new SupportInboxError('제목은 120자 이하여야 합니다.', 'INVALID_INPUT')
  }
  if (content.length > 5000) {
    throw new SupportInboxError('내용은 5000자 이하여야 합니다.', 'INVALID_INPUT')
  }

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      user_id: userId,
      form_type: formType,
      category,
      title,
      content,
      status: 'open',
    })
    .select('id,user_id,form_type,category,title,status,created_at')
    .single()

  if (error) {
    throw new SupportInboxError(error.message ?? '문의 저장에 실패했습니다.', 'DB_ERROR')
  }
  return data
}
