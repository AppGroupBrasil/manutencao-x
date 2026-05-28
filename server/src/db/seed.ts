import bcrypt from 'bcryptjs';
import pool from './database.js';

async function seed() {
  const client = await pool.connect();
  try {
    // Verificar se master já existe
    const { rows } = await client.query(`SELECT id FROM usuarios WHERE role = 'master' LIMIT 1`);
    if (rows.length > 0) {
      console.log('Usuário master já existe. Seed ignorado.');
      return;
    }

    const senha = process.env.MASTER_PASSWORD || 'Master@2026!';
    const senhaHash = await bcrypt.hash(senha, 12);
    await client.query(
      `INSERT INTO usuarios (email, senha_hash, nome, role, criado_por)
       VALUES ($1, $2, $3, 'master', NULL)`,
      [process.env.MASTER_EMAIL || 'master@manutencao.com', senhaHash, 'Master Admin']
    );
    console.log(`Usuário master criado: ${process.env.MASTER_EMAIL || 'master@manutencao.com'}`);
    console.log('⚠️  TROQUE A SENHA APÓS O PRIMEIRO LOGIN!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
