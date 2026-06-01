import { dbRowToLedgerRow, getSql } from "@/lib/db";
import { normalizeImportedRow, sortRows } from "@/lib/ledger";

export async function listLedgerRows(userId) {
  const sql = getSql();
  const rows = await sql`
    select id, trade_date, raw, buy_amount, buy_asset, sell_amount, sell_asset, note, created_at
    from ledger_entries
    where user_id = ${userId}
    order by trade_date desc, created_at desc
  `;

  return rows.map(dbRowToLedgerRow);
}

export async function insertLedgerRow(userId, input) {
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
      ${row.createdAt},
      now()
    )
    on conflict (id) do update set
      trade_date = excluded.trade_date,
      raw = excluded.raw,
      buy_amount = excluded.buy_amount,
      buy_asset = excluded.buy_asset,
      sell_amount = excluded.sell_amount,
      sell_asset = excluded.sell_asset,
      note = excluded.note,
      updated_at = now()
    where ledger_entries.user_id = ${userId}
    returning id, trade_date, raw, buy_amount, buy_asset, sell_amount, sell_asset, note, created_at
  `;

  if (!inserted[0]) {
    const error = new Error("A ledger row with that ID already exists for another account");
    error.status = 409;
    throw error;
  }

  return dbRowToLedgerRow(inserted[0]);
}

export async function deleteLedgerRow(userId, id) {
  const sql = getSql();
  await sql`
    delete from ledger_entries
    where user_id = ${userId} and id = ${id}
  `;
}

export async function importLedgerRows(userId, rows, mode) {
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

  if (mode === "replace") {
    queries.push(sql`delete from ledger_entries where user_id = ${userId}`);
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
        ${row.createdAt},
        now()
      )
      on conflict (id) do nothing
    `);
  }

  if (queries.length) {
    await sql.transaction(queries, { isolationMode: "Serializable" });
  }

  return sortRows(await listLedgerRows(userId));
}
