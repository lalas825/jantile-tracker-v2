
const { createClient } = require('@supabase/supabase-client');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('workers').select('name, role');
    console.log(JSON.stringify(data, null, 2));
}
check();
