import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
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
    const mode = url.searchParams.get('mode')

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
        const body = await req.json().catch(() => ({})) as { issueIds?: string[] | string }
        if (Array.isArray(body.issueIds)) {
          ids = body.issueIds.filter(Boolean)
        } else if (typeof body.issueIds === 'string') {
          ids = body.issueIds.split(',').map((id) => id.trim()).filter(Boolean)
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
        const actFields = 'target(id),timestamp,field(name),added(name)'
        const idQueries = ids.map(id => `issue id: ${id}`).join(' or ')
        const actUrl = `${base}/api/activities?query=${encodeURIComponent(`(${idQueries})`)}&fields=${encodeURIComponent(actFields)}&categories=CustomFieldCategory`
        const activities = await fetchAllPages(actUrl, YOUTRACK_TOKEN, 200)

        const idSet = new Set(ids)
        for (const act of activities) {
          if (act.field?.name !== 'State' || !act.added || !act.target?.id) continue
          if (!idSet.has(act.target.id)) continue

          const addedNames = Array.isArray(act.added) ? act.added : [act.added]
          for (const added of addedNames) {
            const name = (added.name || '').toLowerCase()
            if (name.includes('progress') || name.includes('andamento') || name.includes('desenvolvimento') || name.includes('doing')) {
              const ts = new Date(act.timestamp).toISOString()
              const prev = startedAtMap[act.target.id]
              if (!prev || ts < prev) {
                startedAtMap[act.target.id] = ts
              }
            }
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
