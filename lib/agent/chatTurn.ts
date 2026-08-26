import type { AgentResponse, ChangeProposal } from './proposal'

export type ChatTurnState =
  | { status: 'idle' }
  | { status: 'sending'; request: string }
  | { status: 'awaiting-clarification'; question: string }
  | { status: 'batch-ready'; batch: ChangeProposal[] }
  | { status: 'error'; message: string }

export function nextChatTurnState(response: AgentResponse): ChatTurnState {
  if (response.type === 'clarification') {
    return { status: 'awaiting-clarification', question: response.question }
  }
  return { status: 'batch-ready', batch: response.batch }
}
