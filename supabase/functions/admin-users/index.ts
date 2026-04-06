import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user: caller } } = await anonClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check admin role
    const { data: roleData } = await anonClient.rpc('has_role', { _user_id: caller.id, _role: 'admin' })
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'list_users': {
        const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
        if (error) throw error
        return new Response(JSON.stringify({ users: data.users }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'reset_password': {
        const { email } = body
        if (!email) throw new Error('Email is required')
        const { error } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: `${req.headers.get('origin') || supabaseUrl}` }
        })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'delete_user': {
        const { userId } = body
        if (!userId) throw new Error('userId is required')
        if (userId === caller.id) throw new Error('Cannot delete yourself')
        const { error } = await adminClient.auth.admin.deleteUser(userId)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'invite_user': {
        const { email } = body
        if (!email) throw new Error('Email is required')
        const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${req.headers.get('origin') || supabaseUrl}`
        })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'update_approval': {
        const { userId, approved } = body
        if (!userId) throw new Error('userId is required')
        const { error } = await adminClient.from('profiles').update({ approved }).eq('id', userId)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'set_role': {
        const { userId, role } = body
        if (!userId || !role) throw new Error('userId and role are required')
        // Delete existing roles (exclusive)
        await adminClient.from('user_roles').delete().eq('user_id', userId)
        const { error } = await adminClient.from('user_roles').insert({ user_id: userId, role })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'remove_role': {
        const { userId } = body
        if (!userId) throw new Error('userId is required')
        const { error } = await adminClient.from('user_roles').delete().eq('user_id', userId)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
