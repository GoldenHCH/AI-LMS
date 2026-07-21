import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from('courses')
    .delete()
    .eq('workspace_id', workspaceId)

  if (error) {
    throw new Error('Workspace could not be deleted')
  }
}
