const { Client } = require('pg')

const SOURCE_URL =
  process.env.SOURCE_DATABASE_URL ||
  'postgresql://postgres:123johny@localhost:5432/plataformaj?schema=public'

const TARGET_URL =
  process.env.TARGET_DATABASE_URL ||
  'postgresql://postgres.vfkbtsmoepvqpnvgrrcq:BMPXeixjU0RDdABw@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require'

function q(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

function topoSort(nodes, depsByNode) {
  const sorted = []
  const visiting = new Set()
  const visited = new Set()

  function visit(node) {
    if (visited.has(node)) return
    if (visiting.has(node)) return

    visiting.add(node)
    const deps = depsByNode.get(node) || new Set()
    for (const dep of deps) {
      visit(dep)
    }
    visiting.delete(node)
    visited.add(node)
    sorted.push(node)
  }

  for (const node of nodes) {
    visit(node)
  }

  return sorted
}

async function main() {
  const source = new Client({ connectionString: SOURCE_URL })
  const target = new Client({
    connectionString: TARGET_URL,
    ssl: { rejectUnauthorized: false },
  })

  await source.connect()
  await target.connect()

  try {
    const tablesRes = await source.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const jsonColsRes = await source.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('json', 'jsonb')
    `)

    const tables = tablesRes.rows.map((r) => r.table_name)
    if (tables.length === 0) {
      console.log('Nenhuma tabela encontrada em public.')
      return
    }

    const fkRes = await source.query(`
      SELECT
        tc.table_name AS table_name,
        ccu.table_name AS referenced_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `)

    const depsByNode = new Map()
    const jsonColsByTable = new Map()
    for (const t of tables) depsByNode.set(t, new Set())
    for (const row of jsonColsRes.rows) {
      if (!jsonColsByTable.has(row.table_name)) {
        jsonColsByTable.set(row.table_name, new Set())
      }
      jsonColsByTable.get(row.table_name).add(row.column_name)
    }
    for (const row of fkRes.rows) {
      if (
        depsByNode.has(row.table_name) &&
        depsByNode.has(row.referenced_table)
      ) {
        depsByNode.get(row.table_name).add(row.referenced_table)
      }
    }

    const ordered = topoSort(tables, depsByNode)
    const reverseOrdered = [...ordered].reverse()

    console.log(`Tabelas detectadas: ${tables.length}`)
    console.log('Limpando destino...')

    await target.query('BEGIN')
    await target.query('SET CONSTRAINTS ALL DEFERRED')

    for (const table of reverseOrdered) {
      await target.query(
        `TRUNCATE TABLE public.${q(table)} RESTART IDENTITY CASCADE`,
      )
    }

    for (const table of ordered) {
      const srcRows = await source.query(`SELECT * FROM public.${q(table)}`)
      const rows = srcRows.rows
      if (rows.length === 0) {
        console.log(`- ${table}: 0 linhas`)
        continue
      }

      const cols = Object.keys(rows[0])
      const jsonCols = jsonColsByTable.get(table) || new Set()
      const colSql = cols.map((c) => q(c)).join(', ')

      const chunkSize = 200
      let inserted = 0
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const values = []
        const placeholders = []

        chunk.forEach((row, rowIndex) => {
          const rowPlaceholders = cols.map((c, colIndex) => {
            const raw = row[c]
            if (raw !== null && jsonCols.has(c) && typeof raw === 'object') {
              values.push(JSON.stringify(raw))
            } else {
              values.push(raw)
            }
            return `$${rowIndex * cols.length + colIndex + 1}`
          })
          placeholders.push(`(${rowPlaceholders.join(', ')})`)
        })

        const sql = `INSERT INTO public.${q(table)} (${colSql}) VALUES ${placeholders.join(', ')}`
        await target.query(sql, values)
        inserted += chunk.length
      }

      console.log(`- ${table}: ${inserted} linhas`)
    }

    await target.query('COMMIT')
    console.log('Migracao concluida com sucesso.')
  } catch (err) {
    try {
      await target.query('ROLLBACK')
    } catch {
      // ignore rollback errors
    }
    throw err
  } finally {
    await source.end()
    await target.end()
  }
}

main().catch((err) => {
  console.error('Erro na migracao:', err.message)
  process.exit(1)
})
