import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const YOUTRACK_URL = Deno.env.get('YOUTRACK_URL')
    const YOUTRACK_TOKEN = Deno.env.get('YOUTRACK_TOKEN')

    if (!YOUTRACK_URL || !YOUTRACK_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'YouTrack credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const project = url.searchParams.get('project') || 'ATT'
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    let query = `project: ${project}`
    if (dateFrom) {
      query += ` created: ${dateFrom} .. ${dateTo || 'Today'}`
    }

    const fields = 'id,idReadable,summary,created,resolved,customFields($type,id,projectCustomField($type,id,field($type,id,name)),value($type,id,name,minutes,presentation)),timeTracking(estimation(minutes),spentTime(minutes)),reporter(login,fullName),assignee(login,fullName)'

    const allIssues: any[] = []
    let skip = 0
    const top = 500
    let hasMore = true

    while (hasMore) {
      const apiUrl = `${YOUTRACK_URL}/api/issues?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&$top=${top}&$skip=${skip}`

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${YOUTRACK_TOKEN}`,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || ''
        let errorDetail: string
        if (contentType.includes('application/json')) {
          errorDetail = JSON.stringify(await response.json())
        } else {
          const text = await response.text()
          errorDetail = text.substring(0, 200)
        }
        return new Response(
          JSON.stringify({ error: `YouTrack API error [${response.status}]: ${errorDetail}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await response.text()
        return new Response(
          JSON.stringify({ error: `YouTrack returned non-JSON response. Check YOUTRACK_URL is correct (should be like https://youtrack.company.com). Response: ${text.substring(0, 200)}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const issues = await response.json()
      allIssues.push(...issues)

      if (issues.length < top) {
        hasMore = false
      } else {
        skip += top
      }
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

    const tasks = allIssues.map((issue) => {
      const estimationFromField = getMinutes(issue, 'Estimativa')
      const spentFromField = getMinutes(issue, 'Tempo gasto')

      return {
        taskCode: issue.idReadable,
        title: issue.summary,
        category: getField(issue, 'Type') || 'Tarefa',
        billingStatus: getField(issue, 'Faturável') || 'Nenhum Faturável',
        squad: getField(issue, 'Squad') || 'Sem Squad',
        assignee: issue.assignee?.fullName || issue.assignee?.login || null,
        estimatedMinutes: estimationFromField,
        spentMinutes: spentFromField,
        status: getField(issue, 'State') || 'Open',
        createdAt: new Date(issue.created).toISOString(),
        resolvedAt: issue.resolved ? new Date(issue.resolved).toISOString() : null,
      }
    })

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
