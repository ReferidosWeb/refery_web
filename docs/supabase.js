import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'


export const supabase = createClient(
'https://dinpvaecmrdxlcuzrpvf.supabase.co',
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbnB2YWVjbXJkeGxjdXpycHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTQ1NzYsImV4cCI6MjA4NDM3MDU3Nn0.oeGB0vf4KDzoB65JHSvcGtIVki3m316f4NbYA2wAsfk'
)