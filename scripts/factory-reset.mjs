import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Load Environment Variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const envVars = {};
for (const line of envFile.split('\n')) {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    envVars[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
  }
}

const SUPABASE_URL = envVars.SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Critical: Could not load SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY from .env.local");
  process.exit(1);
}

// 2. Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== FACTORY RESET & ADMIN PROVISIONING ===");
  console.log(`Connecting to: ${SUPABASE_URL}`);
  
  // 3. Delete ALL Auth Users (this usually cascades to public.users & related tables)
  console.log("\n[1/4] Fetching all Supabase Auth Users...");
  let hasMore = true;
  let page = 1;
  while (hasMore) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("Error fetching users:", error.message);
      break;
    }
    
    if (!users || users.length === 0) {
      hasMore = false;
      break;
    }
    
    console.log(`Found ${users.length} users in page ${page}. Deleting...`);
    for (const user of users) {
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
      if (delError) {
        console.error(`Failed to delete user ${user.id}:`, delError.message);
      }
    }
    page++;
  }
  console.log("-> All Auth users mapped and deleted.");

  // 4. Force-clean public tables if cascade is off (Redundancy)
  // We'll delete from 'users' which will cascade to wallets, referrals, etc.
  console.log("\n[2/4] Wiping operational public tables (redundancy)...");
  
  // Clear any residual entities
  const tablesToClear = ['commission_entries', 'withdrawal_requests', 'payments', 'users', 'admin_users'];
  for (const table of tablesToClear) {
    try {
      // In Supabase, delete with an unconstrained .neq id or similar clears the table
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== 'PGRST116') { // Ignore empty rows warning
         console.warn(`Note: Could not clear ${table} (maybe cascading handled it, or no data):`, error.message);
      } else {
         console.log(`-> Cleared table: public.${table}`);
      }
    } catch (err) {
      // Ignore
    }
  }

  // 5. Create the two definitive admin users
  console.log("\n[3/4] Creating the two Master Admin Users...");
  
  const defaultPass1 = 'AxePrime#2026';
  const defaultPass2 = 'DanielAxe@2026';
  
  const adminsToCreate = [
    {
      name: 'Equipe AXE PRIME',
      email: 'contatoaxeprime@gmail.com',
      password: defaultPass1, // They can change this later
      role: 'master',
      active: true,
      id: `adm-${Date.now()}-1`
    },
    {
      name: 'Daniel Cordeiro',
      email: 'daniel01cordeiro@gmail.com',
      password: defaultPass2,
      role: 'master',
      active: true,
      id: `adm-${Date.now()}-2`
    }
  ];

  for (const adm of adminsToCreate) {
    const { error } = await supabase.from('admin_users').insert(adm);
    if (error) {
      console.error(`Failed to create admin ${adm.email}:`, error.message);
    } else {
      console.log(`-> Master Admin Created: ${adm.email}`);
    }
  }

  console.log("\n[4/4] COMPLETE!");
  console.log("-----------------------------------------");
  console.log("Credenciais para acesso ao Admin:");
  console.log(`1. Login: contatoaxeprime@gmail.com  | Senha: ${defaultPass1}`);
  console.log(`2. Login: daniel01cordeiro@gmail.com | Senha: ${defaultPass2}`);
  console.log("-----------------------------------------");
}

main().catch(console.error);
