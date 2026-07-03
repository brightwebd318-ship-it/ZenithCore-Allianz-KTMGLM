require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Create test attendance
  const uid = 'u1111111-1111-1111-1111-111111111111'; // Dibin
  const tid = 't1111111-1111-1111-1111-111111111111';
  const today = new Date().toISOString().split('T')[0];
  
  await supabase.from('attendance').delete().eq('user_id', uid).eq('date', today);
  
  const { data: ins, error: errIns } = await supabase.from('attendance').insert({
    tenant_id: tid,
    user_id: uid,
    date: today,
    check_in: new Date().toISOString(),
    status: 'PRESENT',
    mode: 'QR'
  }).select();
  
  console.log("Inserted:", ins, errIns);
  
  if (ins) {
    const { data: upd, error: errUpd } = await supabase.from('attendance').update({
      check_in: new Date().toISOString(),
      check_out: new Date().toISOString(),
      status: 'PRESENT',
      mode: 'MANUAL',
      notes: '',
      date: today,
      tenant_id: tid,
      user_id: uid
    }).eq('id', ins[0].id).select();
    
    console.log("Updated:", upd, errUpd);
  }
}
test();
