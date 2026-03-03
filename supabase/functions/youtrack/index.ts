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

    // Fetch state change activities to determine "started_at" (when moved to In Progress)
    const issueIds = allIssues.map(i => i.id)
    const startedAtMap = new Map<string, string>() // issue id -> ISO timestamp

    if (issueIds.length > 0) {
      try {
        // Fetch activities in bulk using activitiesPage endpoint
        const activityFields = 'target(id,idReadable),timestamp,field(id,name),added(name),removed(name)'
        const activityQuery = `project: ${project}`
        if (dateFrom) {
          // Use same query scope
        }

        // We'll fetch activities for the specific issues using their IDs
        // Process in batches to avoid URL length limits
        const batchSize = 50
        for (let i = 0; i < allIssues.length; i += batchSize) {
          const batch = allIssues.slice(i, i + batchSize)
          const issueIdList = batch.map((iss: any) => iss.idReadable).join(', ')
          const actQuery = `issue id: ${issueIdList}`
          
          let actSkip = 0
          let actHasMore = true

          while (actHasMore) {
            const actUrl = `${YOUTRACK_URL}/api/activities?query=${encodeURIComponent(actQuery)}&fields=${encodeURIComponent(activityFields)}&categories=CustomFieldCategory&$top=500&$skip=${actSkip}`

            const actResponse = await fetch(actUrl, {
              headers: {
                'Authorization': `Bearer ${YOUTRACK_TOKEN}`,
                'Accept': 'application/json',
              },
            })

            if (!actResponse.ok) {
              console.error(`Activities API error: ${actResponse.status}`)
              actHasMore = false
              break
            }

            const actContentType = actResponse.headers.get('content-type') || ''
            if (!actContentType.includes('application/json')) {
              actHasMore = false
              break
            }

            const activities = await actResponse.json()

            for (const act of activities) {
              // Look for State field changes where added value indicates "In Progress" or similar
              if (act.field?.name === 'State' && act.added && act.target?.id) {
                const addedNames = Array.isArray(act.added) ? act.added : [act.added]
                for (const added of addedNames) {
                  const name = (added.name || '').toLowerCase()
                  if (name.includes('progress') || name.includes('andamento') || name.includes('em desenvolvimento') || name.includes('in progress') || name.includes('doing')) {
                    const issueId = act.target.id
                    const ts = new Date(act.timestamp).toISOString()
                    // Keep the earliest "started" timestamp
                    if (!startedAtMap.has(issueId) || ts < startedAtMap.get(issueId)!) {
                      startedAtMap.set(issueId, ts)
                    }
                  }
                }
              }
            }

            if (activities.length < 500) {
              actHasMore = false
            } else {
              actSkip += 500
            }
          }
        }
      } catch (actError) {
        console.error('Error fetching activities for cycle time:', actError)
        // Non-fatal: cycle time will just be null
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
        startedAt: startedAtMap.get(issue.id) || null,
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
