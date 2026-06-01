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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists ledger_entries_user_date_idx
  on ledger_entries (user_id, trade_date desc, created_at desc);
