import { createClient } from '@supabase/supabase-js'

/* The shared chapri-apps backend: one account for every app. Only the public
   URL and publishable key reach the browser — they are safe to ship, because
   row-level security lets each user read and write their own rows only. The
   secret key never belongs here.

   Without the two variables (tests, a fork) there is no client and the app is
   exactly the offline app it always was.

   Sign-in is an email link back to the app (PKCE: the link only works in the
   browser that asked for it, so a forwarded email signs no one else in). The
   client takes the `?code=` off the URL by itself. */
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null
