import { PGlite } from "@electric-sql/pglite";
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
const food = "33333333-3333-4333-8333-333333333333",
  meal = "44444444-4444-4444-8444-444444444444";
async function asUser(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function count(table: string) {
  return (
    await db.query<{ n: number }>(
      `select count(*)::int as n from public.${table}`,
    )
  ).rows[0].n;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    `begin;reset role;insert into auth.users values('${alice}'),('${bob}');insert into public.foods(id,name) values('${food}','Test ingredient');`,
  );
});
afterEach(async () => {
  await db.exec("rollback;reset role;");
});
describe("Postgres ownership and transactions", () => {
  it("creates an empty profile on signup", async () => {
    await asUser(alice);
    expect(await count("profiles")).toBe(1);
    expect(await count("weight_entries")).toBe(0);
  });
  it("isolates every private table with RLS", async () => {
    const tables = [
      "profiles",
      "user_goals",
      "macro_targets",
      "user_preferences",
      "store_preferences",
      "budgets",
      "notification_preferences",
      "daily_logs",
      "weight_entries",
      "workouts",
      "pantry_items",
      "extra_foods",
      "daily_meal_logs",
      "pantry_movements",
    ];
    const result = await db.query<{ relname: string }>(
      `select relname from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='public' and relrowsecurity`,
    );
    for (const table of tables)
      expect(result.rows.map((r) => r.relname)).toContain(table);
  });
  it("blocks reading or modifying another user’s rows", async () => {
    await db.exec(
      `insert into public.weight_entries(user_id,local_date,weight_kg) values('${bob}','2026-09-05',80)`,
    );
    await asUser(alice);
    expect(await count("weight_entries")).toBe(0);
    await db.exec(
      `update public.weight_entries set weight_kg=70 where user_id='${bob}'`,
    );
    await asUser(bob);
    expect(
      (
        await db.query<{ weight_kg: number }>(
          "select weight_kg from public.weight_entries",
        )
      ).rows[0].weight_kg,
    ).toBe("80");
  });
  it("rejects a forged owner on insert", async () => {
    await asUser(alice);
    await expect(
      db.exec(
        `insert into public.weight_entries(user_id,local_date,weight_kg) values('${bob}','2026-09-05',80)`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("adds water without overwriting other daily checkoffs", async () => {
    await asUser(alice);
    await db.exec(
      `insert into public.daily_logs(user_id,local_date,breakfast) values('${alice}','2026-09-05',true);select public.add_water('2026-09-05',500);select public.add_water('2026-09-05',250);`,
    );
    const row = (
      await db.query<{ water_ml: number; breakfast: boolean }>(
        "select * from public.daily_logs",
      )
    ).rows[0];
    expect(row.water_ml).toBe(750);
    expect(row.breakfast).toBe(true);
  });
  it("creates separate dates instead of resetting yesterday", async () => {
    await asUser(alice);
    await db.exec(
      `select public.add_water('2026-09-05',500);select public.add_water('2026-09-06',250)`,
    );
    expect(await count("daily_logs")).toBe(2);
  });
  it("deducts pantry once and restores the actual deduction on undo", async () => {
    await db.exec(
      `insert into public.pantry_items(user_id,food_id,quantity_g) values('${alice}','${food}',100);insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('${meal}','${alice}','2026-09-05','Lunch','Test meal',400,30,40,10,5,'[{"food_id":"${food}","quantity_g":150}]');`,
    );
    await asUser(alice);
    await db.exec(
      `select public.set_meal_status('${meal}','completed');select public.set_meal_status('${meal}','completed')`,
    );
    expect(
      (
        await db.query<{ quantity_g: string }>(
          "select quantity_g from public.pantry_items",
        )
      ).rows[0].quantity_g,
    ).toBe("0");
    expect(await count("pantry_movements")).toBe(1);
    await db.exec(`select public.set_meal_status('${meal}','planned')`);
    expect(
      (
        await db.query<{ quantity_g: string }>(
          "select quantity_g from public.pantry_items",
        )
      ).rows[0].quantity_g,
    ).toBe("100");
    expect(await count("pantry_movements")).toBe(0);
  });
  it("blocks cross-user completion even with a known meal ID", async () => {
    await db.exec(
      `insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber) values('${meal}','${bob}','2026-09-05','Lunch','Private meal',400,30,40,10,5)`,
    );
    await asUser(alice);
    await expect(
      db.exec(`select public.set_meal_status('${meal}','completed')`),
    ).rejects.toThrow("Meal not found");
  });
  it("prevents bypassing the pantry transaction with direct updates", async () => {
    await asUser(alice);
    await expect(
      db.exec(`update public.daily_meal_logs set status='completed'`),
    ).rejects.toThrow(/permission denied/);
  });
  it("rejects negative ingredient consumption without partial writes", async () => {
    await db.exec(
      `insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('${meal}','${alice}','2026-09-05','Lunch','Invalid meal',400,30,40,10,5,'[{"food_id":"${food}","quantity_g":-100}]')`,
    );
    await asUser(alice);
    await expect(
      db.exec(`select public.set_meal_status('${meal}','completed')`),
    ).rejects.toThrow("Invalid ingredient quantity");
  });
});

describe("saved meal plans", () => {
  async function draft() {
    const t = (
      await db.query<{ id: string }>(
        "select id from public.meals where slug='yogurt-oats'",
      )
    ).rows[0];
    const ingredients = (
      await db.query<{ food_id: string; quantity_g: string }>(
        `select food_id,quantity_g from public.meal_items where meal_id='${t.id}'`,
      )
    ).rows.map((i) => ({ ...i, quantity_g: Number(i.quantity_g) }));
    const date = (
      await db.query<{ date: string }>(
        "select ((now() at time zone 'America/Los_Angeles')::date)::text as date",
      )
    ).rows[0].date;
    return [
      {
        date,
        meals: [
          { template_id: t.id, slot: "Breakfast", ingredients },
          { template_id: t.id, slot: "Snack", ingredients },
        ],
      },
    ];
  }
  it("saves normalized days and recomputes nutrition inside the transaction", async () => {
    const plan = await draft();
    await asUser(alice);
    await db.query("select public.save_meal_plan($1::jsonb,0)", [
      JSON.stringify(plan),
    ]);
    expect(await count("meal_plan_days")).toBe(1);
    expect(await count("meal_plan_entries")).toBe(2);
    expect(await count("daily_meal_logs")).toBe(2);
    const calories = (
      await db.query<{ calories: string }>(
        "select calories from public.daily_meal_logs limit 1",
      )
    ).rows[0].calories;
    expect(Number(calories)).toBeGreaterThan(400);
  });
  it("rejects stale saves without duplicating generated meals", async () => {
    const plan = await draft();
    await asUser(alice);
    await db.query("select public.save_meal_plan($1::jsonb,0)", [
      JSON.stringify(plan),
    ]);
    await expect(
      db.query("select public.save_meal_plan($1::jsonb,0)", [
        JSON.stringify(plan),
      ]),
    ).rejects.toThrow("another session");
  });
  it("protects generated days once a meal has been completed", async () => {
    const plan = await draft();
    await asUser(alice);
    await db.query("select public.save_meal_plan($1::jsonb,0)", [
      JSON.stringify(plan),
    ]);
    const id = (
      await db.query<{ id: string }>(
        "select id from public.daily_meal_logs limit 1",
      )
    ).rows[0].id;
    await db.query("select public.set_meal_status($1,'completed')", [id]);
    await expect(
      db.query("select public.save_meal_plan($1::jsonb,1)", [
        JSON.stringify(plan),
      ]),
    ).rejects.toThrow("protected");
  });
  it("does not expose another user’s plans", async () => {
    const plan = await draft();
    await asUser(alice);
    await db.query("select public.save_meal_plan($1::jsonb,0)", [
      JSON.stringify(plan),
    ]);
    await asUser(bob);
    expect(await count("meal_plan_days")).toBe(0);
    expect(await count("meal_plan_entries")).toBe(0);
  });
});

describe("pantry and grocery integration", () => {
  it("ignores expired stock on completion", async () => {
    await db.exec(
      `insert into public.pantry_items(user_id,food_id,quantity_g,expires_on) values('${alice}','${food}',100,'2026-09-04');insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('${meal}','${alice}','2026-09-05','Lunch','Test meal',400,30,40,10,5,'[{"food_id":"${food}","quantity_g":50}]')`,
    );
    await asUser(alice);
    await db.query("select public.set_meal_status($1,'completed')", [meal]);
    expect(
      Number(
        (
          await db.query<{ quantity_g: string }>(
            "select quantity_g from public.pantry_items",
          )
        ).rows[0].quantity_g,
      ),
    ).toBe(100);
    expect(await count("pantry_movements")).toBe(0);
  });
  it("recalculates requirements while preserving manual and checked items", async () => {
    const date = (
      await db.query<{ date: string }>(
        "select ((now() at time zone 'America/Los_Angeles')::date)::text as date",
      )
    ).rows[0].date;
    await db.exec(
      `insert into public.pantry_items(user_id,food_id,quantity_g) values('${alice}','${food}',100);insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('${meal}','${alice}','${date}','Lunch','Test meal',400,30,40,10,5,'[{"food_id":"${food}","quantity_g":250}]')`,
    );
    await asUser(alice);
    await db.query("select public.refresh_shopping_list($1,$1)", [date]);
    const first = (
      await db.query<{ amount: string; list_id: string }>(
        "select amount,list_id from public.shopping_list_items",
      )
    ).rows[0];
    expect(Number(first.amount)).toBe(150);
    await db.exec(
      `update public.shopping_list_items set purchased=true;insert into public.shopping_list_items(user_id,list_id,name,amount,unit,source) values('${alice}','${first.list_id}','Paper towels',2,'piece','manual')`,
    );
    await db.query("select public.refresh_shopping_list($1,$1)", [date]);
    expect(await count("shopping_list_items")).toBe(2);
    expect(
      (
        await db.query<{ purchased: boolean }>(
          "select purchased from public.shopping_list_items where source='generated'",
        )
      ).rows[0].purchased,
    ).toBe(true);
    await asUser(bob);
    expect(await count("shopping_list_items")).toBe(0);
  });
});

describe("purchases and pricing ownership", () => {
  const pid = "55555555-5555-4555-8555-555555555555";
  const purchase = {
    id: pid,
    store_id: null,
    store_name: "Test store",
    purchased_on: "2026-09-01",
    currency: "USD",
    total: 7,
    notes: "",
  };
  const items = [
    {
      food_id: food,
      retail_product_id: null,
      name: "Test ingredient",
      quantity: 2,
      unit: "kg",
      unit_price: 3.5,
    },
  ];
  it("saves a receipt atomically and treats repeated creates as one purchase", async () => {
    await asUser(alice);
    await db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
      JSON.stringify(purchase),
      JSON.stringify(items),
    ]);
    await db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
      JSON.stringify(purchase),
      JSON.stringify(items),
    ]);
    expect(await count("purchases")).toBe(1);
    expect(await count("purchase_items")).toBe(1);
    expect(
      (
        await db.query<{ total: string }>(
          "select * from public.purchase_months()",
        )
      ).rows[0].total,
    ).toBe("7.00");
    await db.exec(`delete from public.purchases where id='${pid}'`);
    expect(await count("purchase_items")).toBe(0);
  });
  it("isolates receipt parents, lines and monthly aggregates", async () => {
    await asUser(alice);
    await db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
      JSON.stringify(purchase),
      JSON.stringify(items),
    ]);
    await asUser(bob);
    expect(await count("purchases")).toBe(0);
    expect(await count("purchase_items")).toBe(0);
    expect(
      (await db.query("select * from public.purchase_months()")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
        JSON.stringify(purchase),
        JSON.stringify(items),
      ]),
    ).rejects.toThrow("Purchase not found");
  });
  it("rejects totals below item subtotal", async () => {
    await asUser(alice);
    await expect(
      db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
        JSON.stringify({ ...purchase, total: 1 }),
        JSON.stringify(items),
      ]),
    ).rejects.toThrow("subtotal");
  });
  it("rejects stale edits", async () => {
    await asUser(alice);
    await db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
      JSON.stringify(purchase),
      JSON.stringify(items),
    ]);
    await expect(
      db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
        JSON.stringify({ ...purchase, updated_at: "2000-01-01T00:00:00Z" }),
        JSON.stringify(items),
      ]),
    ).rejects.toThrow("changed");
  });
  it("supports editing items and separates monthly currency totals", async () => {
    await asUser(alice);
    await db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
      JSON.stringify(purchase),
      JSON.stringify(items),
    ]);
    const updated = (
      await db.query<{ updated_at: Date }>(
        "select updated_at from public.purchases",
      )
    ).rows[0].updated_at;
    await db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
      JSON.stringify({ ...purchase, updated_at: updated, total: 8 }),
      JSON.stringify([{ ...items[0], unit_price: 4 }]),
    ]);
    await db.query("select public.save_purchase($1::jsonb,$2::jsonb)", [
      JSON.stringify({
        ...purchase,
        id: "66666666-6666-4666-8666-666666666666",
        currency: "CAD",
      }),
      JSON.stringify(items),
    ]);
    expect(await count("purchase_items")).toBe(2);
    const totals = (
      await db.query<{ currency: string; total: string }>(
        "select * from public.purchase_months()",
      )
    ).rows;
    expect(totals.find((t) => t.currency === "USD")?.total).toBe("8.00");
    expect(totals.find((t) => t.currency === "CAD")?.total).toBe("7.00");
  });
  it("keeps catalog tables read-only and enables RLS on every public table", async () => {
    const unprotected = await db.query(
      "select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity",
    );
    expect(unprotected.rows).toEqual([]);
    await asUser(alice);
    await expect(
      db.exec("update public.store_offers set price=0"),
    ).rejects.toThrow("permission denied");
  });
});
