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
  return cf.value.name || cf.value.presentation || null
}

function getMinutes(issue: any, name: string): number {
  const cf = issue.customFields?.find((f: any) => f.projectCustomField?.field?.name === name)
  if (!cf || !cf.value) return 0
  return cf.value.minutes || 0
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

      try {
        const isStartState = (value: string) => {
          const name = value.toLowerCase()
          return (
            name.includes('progress') ||
            name.includes('andamento') ||
            name.includes('desenvolvimento') ||
            name.includes('doing') ||
            name.includes('review') ||
            name.includes('teste') ||
            name.includes('discovery')
          )
        }

        for (const issueId of ids) {
          try {
            const actFields = 'target(id),timestamp,field(name),added(name,presentation,text),removed(name,presentation,text)'
            const issueFilter = /^[A-Z]+-\d+$/.test(issueId) ? `idReadable: ${issueId}` : `id: ${issueId}`
            const actUrl = `${base}/api/activities?issueQuery=${encodeURIComponent(issueFilter)}&fields=${encodeURIComponent(actFields)}&categories=CustomFieldCategory&$top=120&reverse=false`

            const activities = await fetchJson(actUrl, YOUTRACK_TOKEN, 10000) as any[]
            if (!Array.isArray(activities) || activities.length === 0) continue

            const ordered = [...activities].sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
            for (const act of ordered) {
              if (!act.target?.id || !act.added) continue

              const addedValues = Array.isArray(act.added) ? act.added : [act.added]
              const enteredInProgress = addedValues.some((added: any) => {
                const raw = added?.name || added?.presentation || added?.text || ''
                return isStartState(raw)
              })

              if (enteredInProgress) {
                startedAtMap[act.target.id] = new Date(act.timestamp).toISOString()
                break
              }
            }
          } catch (issueError) {
            console.error(`Activities fetch failed for ${issueId}:`, issueError)
          }
        }
      } catch (e) {
        console.error('Activities fetch error:', e)
      }

      return new Response(
        JSON.stringify({ startedAt: startedAtMap }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // MODE: issues (default)
    let query = `project: ${project}`
    if (dateFrom) {
      query += ` created: ${dateFrom} .. ${dateTo || 'Today'}`
    }

    const fields = 'id,idReadable,summary,created,resolved,customFields($type,id,projectCustomField($type,id,field($type,id,name)),value($type,id,name,minutes,presentation)),reporter(login,fullName),assignee(login,fullName)'
    const issuesUrl = `${base}/api/issues?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`
    const allIssues = await fetchAllPages(issuesUrl, YOUTRACK_TOKEN)

    const tasks = allIssues.map((issue: any) => ({
      id: issue.id,
      taskCode: issue.idReadable,
      title: issue.summary,
      category: getField(issue, 'Type') || 'Tarefa',
      billingStatus: getField(issue, 'Faturável') || 'Nenhum Faturável',
      squad: getField(issue, 'Squad') || 'Sem Squad',
      assignee: issue.assignee?.fullName || issue.assignee?.login || null,
      estimatedMinutes: getMinutes(issue, 'Estimativa'),
      spentMinutes: getMinutes(issue, 'Tempo gasto'),
      status: getField(issue, 'State') || 'Open',
      createdAt: new Date(issue.created).toISOString(),
      resolvedAt: issue.resolved ? new Date(issue.resolved).toISOString() : null,
    }))

    return new Response(
      JSON.stringify({ tasks, total: tasks.length }),
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
