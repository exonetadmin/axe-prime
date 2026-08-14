/**
 * Create Test User Script
 * 
 * Usage: node scripts/create-test-user.js
 */

const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('node:path');

const databasePath = path.join(process.cwd(), 'data', 'axe-prime.db');

const TEST_USER = {
  email: 'teste@axeprime.com.br',
  password: 'Teste123!',
  name: 'Usuário Teste',
  plan: 'prime'
};

async function createTestUser() {
  console.log('🚀 Criando usuário de teste...\n');
  
  try {
    const db = new Database(databasePath);
    
    // Check if user already exists
    const existingUser = db.prepare(
      'SELECT email FROM users WHERE email = ?'
    ).get(TEST_USER.email);
    
    if (existingUser) {
      console.log('⚠️  Usuário já existe:');
      console.log(`   Email: ${TEST_USER.email}`);
      console.log(`   Senha: ${TEST_USER.password}`);
      console.log('\n✅ Use essas credenciais para login.');
      db.close();
      return;
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(TEST_USER.password, 12);
    
    // Create user
    const userId = randomUUID();
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, plan_interest, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      TEST_USER.name,
      TEST_USER.email,
      passwordHash,
      TEST_USER.plan,
      new Date().toISOString()
    );
    
    console.log('✅ Usuário de teste criado com sucesso!\n');
    console.log('📧 Credenciais:');
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Senha: ${TEST_USER.password}`);
    console.log(`   Plano: ${TEST_USER.plan.toUpperCase()}`);
    console.log('\n🌐 Acesse: http://localhost:3000/auth');
    
    db.close();
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    process.exit(1);
  }
}

createTestUser();
