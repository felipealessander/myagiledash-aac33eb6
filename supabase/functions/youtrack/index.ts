import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      const text = await res.text()
      throw new Error(`Non-JSON response. Check YOUTRACK_URL. Response: ${text.substring(0, 200)}`)
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

function getIntField(issue: any, name: string): number {
  const cf = issue.customFields?.find((f: any) => f.projectCustomField?.field?.name === name)
  if (!cf || cf.value == null) return 0
  if (typeof cf.value === 'number') return cf.value
  const parsed = parseInt(cf.value?.presentation || cf.value?.name || cf.value, 10)
  return isNaN(parsed) ? 0 : parsed
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const requestBody = req.method === 'POST'
      ? await req.json().catch(() => ({})) as { mode?: string; issueIds?: string[] | string }
      : {}
    const mode = url.searchParams.get('mode') || requestBody.mode || null

    // Health check
    if (!mode && !url.searchParams.get('dateFrom')) {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const YOUTRACK_URL = Deno.env.get('YOUTRACK_URL')
    const YOUTRACK_TOKEN = Deno.env.get('YOUTRACK_TOKEN')

    if (!YOUTRACK_URL || !YOUTRACK_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'YouTrack credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const base = YOUTRACK_URL.replace(/\/+$/, '')
    const project = url.searchParams.get('project') || 'ATT'
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const issueIds = url.searchParams.get('issueIds')

    // MODE: workitems - fetch period-specific work items
    if (mode === 'workitems') {
      if (!dateFrom || !dateTo) {
        return new Response(
          JSON.stringify({ error: 'dateFrom and dateTo are required for workitems mode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const wiFields = 'id,issue(id,idReadable),duration(minutes),date,author(login,fullName)'
      const wiQuery = `project: ${project}`
      const wiBaseUrl = `${base}/api/workItems?query=${encodeURIComponent(wiQuery)}&startDate=${dateFrom}&endDate=${dateTo}&fields=${encodeURIComponent(wiFields)}`

      const allWorkItems = await fetchAllPages(wiBaseUrl, YOUTRACK_TOKEN, 500)

      // Group by issue idReadable, sum minutes within the period
      const spentByIssue: Record<string, number> = {}

      for (const wi of allWorkItems) {
        const issueKey = wi.issue?.idReadable
        if (!issueKey) continue
        const minutes = wi.duration?.minutes || 0
        spentByIssue[issueKey] = (spentByIssue[issueKey] || 0) + minutes
      }

      return new Response(
        JSON.stringify({ spentByIssue, totalWorkItems: allWorkItems.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // MODE: activities - fetch started_at for specific issue IDs
    if (mode === 'activities') {
      let ids: string[] = []

      if (req.method === 'POST') {
        if (Array.isArray(requestBody.issueIds)) {
          ids = requestBody.issueIds.filter(Boolean)
        } else if (typeof requestBody.issueIds === 'string') {
          ids = requestBody.issueIds.split(',').map((id) => id.trim()).filter(Boolean)
        }
      } else if (issueIds) {
        ids = issueIds.split(',').map((id) => id.trim()).filter(Boolean)
      }

      if (ids.length === 0) {
        return new Response(
          JSON.stringify({ startedAt: {} }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const startedAtMap: Record<string, string> = {}
      const qaReturnsMap: Record<string, number> = {}

      try {
        const START_STATES = [
          'em desenvolvimento',
          'code review',
          'aguardando merge',
          'teste qa',
          'teste dev',
          'em discovery',
          'validação - técnica',
          'validação',
          'concluida',
          'arquivado',
          'priorizado para release',
        ]

        const isStartState = (value: string) => {
          const lower = value.toLowerCase().trim()
          return START_STATES.some(s => lower.includes(s) || s.includes(lower))
        }

        for (const issueId of ids) {
          try {
            const actFields = 'timestamp,field(name),added(name,presentation,text),removed(name,presentation,text)'
            const actUrl = `${base}/api/issues/${encodeURIComponent(issueId)}/activities?fields=${encodeURIComponent(actFields)}&categories=CustomFieldCategory&$top=200`

            const activities = await fetchJson(actUrl, YOUTRACK_TOKEN, 10000) as any[]
            if (!Array.isArray(activities) || activities.length === 0) continue

            const ordered = [...activities].sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
            let qaReturnCount = 0

            for (const act of ordered) {
              if (!act.added) continue

              const addedValues = Array.isArray(act.added) ? act.added : [act.added]

              // Detect started_at (first entry into a work state)
              if (!startedAtMap[issueId]) {
                const enteredInProgress = addedValues.some((added: any) => {
                  const raw = added?.name || added?.presentation || added?.text || ''
                  return isStartState(raw)
                })
                if (enteredInProgress) {
                  startedAtMap[issueId] = new Date(act.timestamp).toISOString()
                }
              }

              // Detect QA → Dev transitions (rework)
              const removedValues = Array.isArray(act.removed) ? act.removed : (act.removed ? [act.removed] : [])
              const cameFromQA = removedValues.some((r: any) => {
                const raw = (r?.name || r?.presentation || r?.text || '').toLowerCase().trim()
                return raw.includes('teste qa')
              })
              const wentToDev = addedValues.some((a: any) => {
                const raw = (a?.name || a?.presentation || a?.text || '').toLowerCase().trim()
                return raw.includes('em desenvolvimento')
              })
              if (cameFromQA && wentToDev) {
                qaReturnCount++
              }
            }

            qaReturnsMap[issueId] = qaReturnCount
          } catch (issueError) {
            console.error(`Activities fetch failed for ${issueId}:`, issueError)
          }
        }
      } catch (e) {
        console.error('Activities fetch error:', e)
      }

      return new Response(
        JSON.stringify({ startedAt: startedAtMap, qaReturns: qaReturnsMap }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // MODE: issues (default) - uses "work date" filter to capture all issues with time in period
    let query = `project: ${project}`
    if (dateFrom) {
      query += ` work date: ${dateFrom} .. ${dateTo || 'Today'}`
    }

    const fields = 'id,idReadable,summary,created,resolved,tags(name),customFields($type,id,projectCustomField($type,id,field($type,id,name)),value($type,id,name,fullName,login,minutes,presentation)),reporter(login,fullName),assignee(login,fullName)'
    const issuesUrl = `${base}/api/issues?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`
    const allIssues = await fetchAllPages(issuesUrl, YOUTRACK_TOKEN)



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
      client: getField(issue, 'Cliente') || null,
    }))

    // Debug: include custom field names in response
    const debugFieldNames = allIssues.length > 0
      ? (allIssues[0].customFields || []).map((f: any) => f.projectCustomField?.field?.name)
      : [];

    return new Response(
      JSON.stringify({ tasks, total: tasks.length, debugFieldNames }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('YouTrack sync error:', error)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
