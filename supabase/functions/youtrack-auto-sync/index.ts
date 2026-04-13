import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchJson(url: string, token: string, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`API error [${res.status}]: ${text.substring(0, 200)}`)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchAllPages(baseUrl: string, token: string, top = 500) {
  const all: any[] = []
  let skip = 0
  while (true) {
    const sep = baseUrl.includes('?') ? '&' : '?'
    const url = `${baseUrl}${sep}$top=${top}&$skip=${skip}`
    const page = await fetchJson(url, token)
    all.push(...page)
    if (page.length < top) break
    skip += top
  }
  return all
}

function getField(issue: any, name: string): string | null {
  const cf = issue.customFields?.find((f: any) => f.projectCustomField?.field?.name === name)
  if (!cf || !cf.value) return null
  return cf.value.name || cf.value.fullName || cf.value.login || cf.value.presentation || null
}

function getMinutes(issue: any, name: string): number {
  const cf = issue.customFields?.find((f: any) => f.projectCustomField?.field?.name === name)
  if (!cf || !cf.value) return 0
  return cf.value.minutes || 0
}

function getDateField(issue: any, name: string): string | null {
  const cf = issue.customFields?.find((f: any) => f.projectCustomField?.field?.name === name)
  if (!cf || !cf.value) return null
  if (typeof cf.value === 'number') return new Date(cf.value).toISOString()
  if (cf.value.presentation) {
    const d = new Date(cf.value.presentation)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

function getIntField(issue: any, name: string): number {
  const cf = issue.customFields?.find((f: any) => f.projectCustomField?.field?.name === name)
  if (!cf || cf.value == null) return 0
  if (typeof cf.value === 'number') return cf.value
  const parsed = parseInt(cf.value?.presentation || cf.value?.name || cf.value, 10)
  return isNaN(parsed) ? 0 : parsed
}

const MONTHS_PT = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const START_STATES = [
  'em desenvolvimento', 'code review', 'aguardando merge', 'teste qa',
  'teste dev', 'em discovery', 'validação - técnica', 'validação',
  'concluida', 'arquivado', 'priorizado para release',
]

const isStartState = (value: string) => {
  const lower = value.toLowerCase().trim()
  return START_STATES.some(s => lower.includes(s) || s.includes(lower))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const YOUTRACK_URL = Deno.env.get('YOUTRACK_URL')
    const YOUTRACK_TOKEN = Deno.env.get('YOUTRACK_TOKEN')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!YOUTRACK_URL || !YOUTRACK_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const base = YOUTRACK_URL.replace(/\/+$/, '')
    const project = 'ATT'

    // Determine current month
    const now = new Date()
    const year = now.getFullYear()
    const monthNum = now.getMonth() + 1
    const monthStr = String(monthNum).padStart(2, '0')
    const dateFrom = `${year}-${monthStr}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`
    const monthKey = `${year}-${monthStr}`
    const monthLabel = `${MONTHS_PT[monthNum]} ${year}`

    console.log(`[auto-sync] Starting sync for ${monthLabel} (${dateFrom} → ${dateTo})`)

    // Step 1: Fetch issues
    const fields = 'id,idReadable,summary,created,resolved,tags(name),customFields($type,id,projectCustomField($type,id,field($type,id,name)),value($type,id,name,fullName,login,minutes,presentation)),reporter(login,fullName),assignee(login,fullName)'
    const query = `project: ${project} work date: ${dateFrom} .. ${dateTo}`
    const issuesUrl = `${base}/api/issues?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`
    const allIssues = await fetchAllPages(issuesUrl, YOUTRACK_TOKEN)

    if (allIssues.length === 0) {
      console.log('[auto-sync] No issues found for period')
      return new Response(JSON.stringify({ status: 'ok', tasks: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tasks = allIssues.map((issue: any) => ({
      id: issue.id,
      taskCode: issue.idReadable,
      title: issue.summary,
      category: getField(issue, 'Type') || 'Tarefa',
      billingStatus: getField(issue, 'Faturável') || 'Nenhum Faturável',
      squad: getField(issue, 'Squad') || 'Sem Squad',
      assignee: getField(issue, 'Assignee') || issue.assignee?.fullName || issue.assignee?.login || null,
      estimatedMinutes: getMinutes(issue, 'Estimativa'),
      spentMinutes: getMinutes(issue, 'Tempo gasto'),
      status: getField(issue, 'State') || 'Open',
      createdAt: new Date(issue.created).toISOString(),
      resolvedAt: issue.resolved ? new Date(issue.resolved).toISOString() : null,
      tags: (issue.tags || []).map((tag: any) => tag.name).filter(Boolean),
      correctionsCount: getIntField(issue, 'Quantidade Correções'),
    }))

    console.log(`[auto-sync] ${tasks.length} issues fetched`)

    // Step 2: Fetch period-specific work items
    let spentByIssue: Record<string, number> = {}
    try {
      const wiFields = 'id,issue(id,idReadable),duration(minutes),date,author(login,fullName)'
      const wiQuery = `project: ${project}`
      const wiBaseUrl = `${base}/api/workItems?query=${encodeURIComponent(wiQuery)}&startDate=${dateFrom}&endDate=${dateTo}&fields=${encodeURIComponent(wiFields)}`
      const allWorkItems = await fetchAllPages(wiBaseUrl, YOUTRACK_TOKEN, 500)
      for (const wi of allWorkItems) {
        const issueKey = wi.issue?.idReadable
        if (!issueKey) continue
        const minutes = wi.duration?.minutes || 0
        spentByIssue[issueKey] = (spentByIssue[issueKey] || 0) + minutes
      }
      console.log(`[auto-sync] ${allWorkItems.length} work items fetched`)
    } catch (e) {
      console.error('[auto-sync] Work items fetch failed (non-fatal):', e)
    }

    // Step 3: Fetch activities for cycle time + rework
    const startedAtMap: Record<string, string> = {}
    const qaReturnsMap: Record<string, number> = {}
    const activityBatchSize = 20

    for (let i = 0; i < tasks.length; i += activityBatchSize) {
      const batch = tasks.slice(i, i + activityBatchSize)
      for (const t of batch) {
        try {
          const actFields = 'timestamp,field(name),added(name,presentation,text),removed(name,presentation,text)'
          const actUrl = `${base}/api/issues/${encodeURIComponent(t.taskCode)}/activities?fields=${encodeURIComponent(actFields)}&categories=CustomFieldCategory&$top=200`
          const activities = await fetchJson(actUrl, YOUTRACK_TOKEN, 10000) as any[]
          if (!Array.isArray(activities) || activities.length === 0) continue

          const ordered = [...activities].sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
          let qaReturnCount = 0

          for (const act of ordered) {
            if (!act.added) continue
            const addedValues = Array.isArray(act.added) ? act.added : [act.added]

            if (!startedAtMap[t.taskCode]) {
              const entered = addedValues.some((a: any) => isStartState(a?.name || a?.presentation || a?.text || ''))
              if (entered) startedAtMap[t.taskCode] = new Date(act.timestamp).toISOString()
            }

            const removedValues = Array.isArray(act.removed) ? act.removed : (act.removed ? [act.removed] : [])
            const cameFromQA = removedValues.some((r: any) => (r?.name || r?.presentation || r?.text || '').toLowerCase().includes('teste qa'))
            const wentToDev = addedValues.some((a: any) => (a?.name || a?.presentation || a?.text || '').toLowerCase().includes('em desenvolvimento'))
            if (cameFromQA && wentToDev) qaReturnCount++
          }

          qaReturnsMap[t.taskCode] = qaReturnCount
        } catch {
          // Non-fatal
        }
      }
    }

    console.log(`[auto-sync] Activities processed for ${Object.keys(startedAtMap).length} issues`)

    // Step 4: Upsert report and save tasks
    const { data: report, error: reportError } = await supabase
      .from('sprint_reports')
      .upsert({ month: monthKey, label: monthLabel, sync_type: 'auto' }, { onConflict: 'month' })
      .select('id')
      .single()

    if (reportError) throw reportError

    await supabase.from('report_tasks').delete().eq('report_id', report.id)

    const dbBatchSize = 100
    for (let i = 0; i < tasks.length; i += dbBatchSize) {
      const batch = tasks.slice(i, i + dbBatchSize).map((t: any) => {
        const periodSpent = spentByIssue[t.taskCode]
        const spentMinutes = periodSpent !== undefined ? periodSpent : t.spentMinutes
        return {
          report_id: report.id,
          task_code: t.taskCode,
          title: t.title,
          category: t.category,
          billing_status: t.billingStatus,
          squad: t.squad,
          assignee: t.assignee,
          estimated_minutes: t.estimatedMinutes,
          spent_minutes: spentMinutes,
          status: t.status,
          created_at_yt: t.createdAt,
          resolved_at: t.resolvedAt,
          started_at: startedAtMap[t.taskCode] || (spentMinutes > 0 ? t.createdAt : null),
          tags: t.tags || [],
          corrections_count: t.correctionsCount || 0,
          qa_returns: qaReturnsMap[t.taskCode] || 0,
          client: t.client || null,
        }
      })

      const { error } = await supabase.from('report_tasks').insert(batch)
      if (error) throw error
    }

    console.log(`[auto-sync] Sync complete: ${tasks.length} tasks saved for ${monthLabel}`)

    return new Response(
      JSON.stringify({ status: 'ok', tasks: tasks.length, month: monthLabel }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[auto-sync] Error:', error)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
