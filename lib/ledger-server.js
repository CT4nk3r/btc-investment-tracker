import { dbRowToLedgerRow, getSql } from "@/lib/db";
import { normalizeImportedRow, sortRows } from "@/lib/ledger";

let schemaReady = null;

export async function ensureLedgerSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`
        create table if not exists ledger_entries (
          id text not null,
          user_id text not null,
          trade_date date not null,
          raw text not null default '',
          buy_amount numeric(28, 12) not null check (buy_amount > 0),
          buy_asset text not null,
          sell_amount numeric(28, 12) not null check (sell_amount > 0),
          sell_asset text not null,
          note text not null default '',
          source_metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          primary key (user_id, id)
        )
      `;
      await sql`
        alter table ledger_entries
        add column if not exists source_metadata jsonb not null default '{}'::jsonb
      `;
      await sql`
        create index if not exists ledger_entries_user_date_idx
        on ledger_entries (user_id, trade_date desc, created_at desc)
      `;
    })();
  }

  return schemaReady;
}

export async function listLedgerRows(userId) {
  await ensureLedgerSchema();
  const sql = getSql();
  const rows = await sql`
    select id, trade_date, raw, buy_amount, buy_asset, sell_amount, sell_asset, note, source_metadata, created_at
    from ledger_entries
    where user_id = ${userId}
    order by trade_date desc, created_at desc
  `;

  return rows.map(dbRowToLedgerRow);
}

export async function insertLedgerRow(userId, input) {
  await ensureLedgerSchema();
  const result = normalizeImportedRow(input);
  if (!result.row) {
    const error = new Error(result.error);
    error.status = 400;
    throw error;
  }

  const row = result.row;
  const sql = getSql();
  const inserted = await sql`
    insert into ledger_entries (
      id,
      user_id,
      trade_date,
      raw,
      buy_amount,
      buy_asset,
      sell_amount,
      sell_asset,
      note,
      source_metadata,
      created_at,
      updated_at
    )
    values (
      ${row.id},
      ${userId},
      ${row.date},
      ${row.raw},
      ${row.buyAmount},
      ${row.buyAsset},
      ${row.sellAmount},
      ${row.sellAsset},
      ${row.note},
      ${JSON.stringify(row.sourceMetadata)},
      ${row.createdAt},
      now()
    )
    on conflict (user_id, id) do update set
      trade_date = excluded.trade_date,
      raw = excluded.raw,
      buy_amount = excluded.buy_amount,
      buy_asset = excluded.buy_asset,
      sell_amount = excluded.sell_amount,
      sell_asset = excluded.sell_asset,
      note = excluded.note,
      source_metadata = excluded.source_metadata,
      updated_at = now()
    returning id, trade_date, raw, buy_amount, buy_asset, sell_amount, sell_asset, note, source_metadata, created_at
  `;

  return dbRowToLedgerRow(inserted[0]);
}

export async function deleteLedgerRow(userId, id) {
  await ensureLedgerSchema();
  const sql = getSql();
  await sql`
    delete from ledger_entries
    where user_id = ${userId} and id = ${id}
  `;
}

export async function updateLedgerRow(userId, id, input) {
  await ensureLedgerSchema();
  const result = normalizeImportedRow({
    ...input,
    id,
    createdAt: input.createdAt || new Date().toISOString(),
  });
  if (!result.row) {
    const error = new Error(result.error);
    error.status = 400;
    throw error;
  }

  const row = result.row;
  const sql = getSql();
  const updated = await sql`
    update ledger_entries
    set
      trade_date = ${row.date},
      raw = ${row.raw},
      buy_amount = ${row.buyAmount},
      buy_asset = ${row.buyAsset},
      sell_amount = ${row.sellAmount},
      sell_asset = ${row.sellAsset},
      note = ${row.note},
      source_metadata = ${JSON.stringify(row.sourceMetadata)},
      updated_at = now()
    where user_id = ${userId} and id = ${id}
    returning id, trade_date, raw, buy_amount, buy_asset, sell_amount, sell_asset, note, source_metadata, created_at
  `;

  if (!updated[0]) {
    const error = new Error("Ledger row not found");
    error.status = 404;
    throw error;
  }

  return dbRowToLedgerRow(updated[0]);
}

export async function importLedgerRows(userId, rows, mode) {
  await ensureLedgerSchema();
  const normalizedRows = rows.map((row, index) => {
    const result = normalizeImportedRow(row, index + 1);
    if (!result.row) {
      const error = new Error(`Row ${index + 1}: ${result.error}`);
      error.status = 400;
      throw error;
    }
    return result.row;
  });

  const sql = getSql();
  const queries = [];
  let existingIds = new Set();

  if (mode === "replace") {
    queries.push(sql`delete from ledger_entries where user_id = ${userId}`);
  } else if (normalizedRows.length) {
    const candidateIds = new Set(normalizedRows.map((row) => row.id));
    existingIds = new Set(
      (await listLedgerRows(userId))
        .map((row) => row.id)
        .filter((id) => candidateIds.has(id)),
    );
  }

  for (const row of normalizedRows) {
    queries.push(sql`
      insert into ledger_entries (
        id,
        user_id,
        trade_date,
        raw,
        buy_amount,
        buy_asset,
        sell_amount,
        sell_asset,
        note,
        source_metadata,
        created_at,
        updated_at
      )
      values (
        ${row.id},
        ${userId},
        ${row.date},
        ${row.raw},
        ${row.buyAmount},
        ${row.buyAsset},
        ${row.sellAmount},
        ${row.sellAsset},
        ${row.note},
        ${JSON.stringify(row.sourceMetadata)},
        ${row.createdAt},
        now()
      )
      on conflict (user_id, id) do update set
        source_metadata = case
          when ledger_entries.source_metadata = '{}'::jsonb and excluded.source_metadata <> '{}'::jsonb
            then excluded.source_metadata
          else ledger_entries.source_metadata
        end,
        updated_at = case
          when ledger_entries.source_metadata = '{}'::jsonb and excluded.source_metadata <> '{}'::jsonb
            then now()
          else ledger_entries.updated_at
        end
    `);
  }

  if (queries.length) {
    await sql.transaction(queries, { isolationMode: "Serializable" });
  }

  return {
    rows: sortRows(await listLedgerRows(userId)),
    importedCount: normalizedRows.filter((row) => !existingIds.has(row.id)).length,
    skippedDuplicateCount: normalizedRows.filter((row) => existingIds.has(row.id)).length,
  };
}
