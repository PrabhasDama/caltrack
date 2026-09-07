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
  // Storage's service-owned tables/functions are provided by Supabase in production.
  await db.exec(
    `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`,
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
  it("confirms a reviewed receipt once with stock, budget and a reversible ledger", async () => {
    await asUser(alice);
    await db.exec(
      `insert into public.user_uploads(id,user_id,bucket,path,local_date,status) values('${meal}','${alice}','receipts','${alice}/${meal}.png',current_date-1,'ready')`,
    );
    const review = {
      store: "Receipt store",
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      currency: "USD",
      total: 5,
      items: [
        { name: "Ingredient", quantity: 1, price: 5, foodId: food, grams: 500 },
      ],
    };
    for (let i = 0; i < 3; i++)
      await db.query("select public.confirm_reviewed_receipt($1,$2,true)", [
        meal,
        JSON.stringify(review),
      ]);
    expect(await count("purchases")).toBe(1);
    expect(await count("shopping_fulfillments")).toBe(1);
    expect(
      Number(
        (
          await db.query<{ quantity_g: number }>(
            "select quantity_g from public.pantry_items",
          )
        ).rows[0].quantity_g,
      ),
    ).toBe(500);
    expect(
      Number(
        (
          await db.query<{ total: number }>(
            "select total from public.purchases",
          )
        ).rows[0].total,
      ),
    ).toBe(5);
    const event = (
      await db.query<{ id: string }>(
        "select id from public.shopping_fulfillments",
      )
    ).rows[0].id;
    await asUser(bob);
    expect(await count("purchases")).toBe(0);
    expect(await count("shopping_fulfillments")).toBe(0);
    await asUser(alice);
    await db.query("select public.undo_shopping_purchase($1)", [event]);
    await db.query("select public.undo_shopping_purchase($1)", [event]);
    expect(
      Number(
        (
          await db.query<{ quantity_g: number }>(
            "select quantity_g from public.pantry_items",
          )
        ).rows[0].quantity_g,
      ),
    ).toBe(0);
  });
  it("links confirmed receipt products, groceries and private price history atomically", async () => {
    const p = (
      await db.query<{ id: string; food_id: string; package_grams: number }>(
        "select id,food_id,package_grams from public.retail_products where is_active and food_id is not null and package_grams>100 limit 1",
      )
    ).rows[0];
    await asUser(alice);
    await db.exec(
      `insert into public.user_uploads(id,user_id,bucket,path,local_date,status) values('${meal}','${alice}','receipts','${alice}/${meal}.png',current_date-1,'ready');insert into public.shopping_lists(user_id,start_date,end_date) values('${alice}',current_date,current_date);insert into public.shopping_list_items(user_id,list_id,food_id,name,amount,unit,source) select '${alice}',id,'${p.food_id}','Product',100,'g','manual' from public.shopping_lists`,
    );
    const item = (
      await db.query<{ id: string; updated_at: string }>(
        "select id,updated_at from public.shopping_list_items",
      )
    ).rows[0];
    await db.query("select public.confirm_reviewed_receipt($1,$2,true)", [
      meal,
      JSON.stringify({
        store: "Product store",
        date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        currency: "USD",
        total: 5,
        items: [
          {
            name: "Product",
            quantity: 1,
            price: 5,
            foodId: p.food_id,
            productId: p.id,
            grams: Number(p.package_grams),
            shoppingId: item.id,
            expected: item.updated_at,
          },
        ],
      }),
    ]);
    expect(
      (
        await db.query<{ fulfillment: string }>(
          "select fulfillment from public.shopping_list_items",
        )
      ).rows[0].fulfillment,
    ).toBe("purchased");
    expect(await count("receipt_price_observations")).toBe(1);
    await asUser(bob);
    expect(await count("receipt_price_observations")).toBe(0);
  });
  it("rolls back every receipt write when totals disagree", async () => {
    await asUser(alice);
    await db.exec(
      `insert into public.user_uploads(id,user_id,bucket,path,local_date,status) values('${meal}','${alice}','receipts','${alice}/${meal}.png',current_date-1,'ready');savepoint receipt_attempt`,
    );
    await expect(
      db.query("select public.confirm_reviewed_receipt($1,$2,true)", [
        meal,
        JSON.stringify({
          store: "Store",
          date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
          currency: "USD",
          total: 7,
          items: [
            { name: "Food", quantity: 1, price: 5, foodId: food, grams: 100 },
          ],
        }),
      ]),
    ).rejects.toThrow("Receipt total");
    await db.exec("rollback to receipt_attempt");
    expect(await count("purchases")).toBe(0);
    expect(await count("pantry_items")).toBe(0);
  });
  it("requires explicit receipt confirmation", async () => {
    await asUser(alice);
    await expect(
      db.query("select public.confirm_reviewed_receipt($1,'{}',false)", [meal]),
    ).rejects.toThrow("Review and confirm");
  });
  it("records explicit waste once, excluding invented cost, and reconciles stock", async () => {
    await db.exec(
      `insert into public.pantry_items(user_id,food_id,quantity_g) values('${alice}','${food}',200)`,
    );
    await asUser(alice);
    const row = (
      await db.query<{ id: string; updated_at: string }>(
        "select id,updated_at from public.pantry_items",
      )
    ).rows[0];
    for (let i = 0; i < 2; i++)
      await db.query("select public.record_food_waste($1,$2,$3,'discarded')", [
        meal,
        row.id,
        row.updated_at,
      ]);
    expect(await count("food_waste_events")).toBe(1);
    expect(
      (
        await db.query<{ estimated_cost: number | null }>(
          "select estimated_cost from public.food_waste_events",
        )
      ).rows[0].estimated_cost,
    ).toBeNull();
    expect(
      Number(
        (
          await db.query<{ quantity_g: number }>(
            "select quantity_g from public.pantry_items",
          )
        ).rows[0].quantity_g,
      ),
    ).toBe(0);
    await asUser(bob);
    expect(await count("food_waste_events")).toBe(0);
  });
  it("allows account deletion to remove completion audit rows", async () => {
    await db.exec(
      `insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients,status) values('${meal}','${alice}',current_date,'Lunch','Test',100,10,10,1,1,'[]','completed');delete from auth.users where id='${alice}'`,
    );
    expect(await count("meal_completion_events")).toBe(0);
  });
  it("records completion time once, preserves its audit, and timestamps recompletion", async () => {
    await db.exec(
      `insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('${meal}','${alice}',current_date-1,'Lunch','Test',100,10,10,1,1,'[]')`,
    );
    await asUser(alice);
    await db.query("select public.set_meal_status($1,'completed')", [meal]);
    const timestamp = async () =>
      (
        await db.query<{ completed_at: string }>(
          "select completed_at from public.daily_meal_logs",
        )
      ).rows[0].completed_at;
    const first = await timestamp();
    expect(first).toBeTruthy();
    await db.query("select public.set_meal_status($1,'completed')", [meal]);
    expect(await timestamp()).toEqual(first);
    expect(await count("meal_completion_events")).toBe(1);
    await db.query("select public.set_meal_status($1,'planned')", [meal]);
    expect(await timestamp()).toBeNull();
    expect(await count("meal_completion_events")).toBe(2);
    await db.query("select public.set_meal_status($1,'completed')", [meal]);
    expect(new Date(await timestamp()).getTime()).toBeGreaterThanOrEqual(
      new Date(first).getTime(),
    );
    expect(await count("meal_completion_events")).toBe(3);
    await asUser(bob);
    expect(await count("meal_completion_events")).toBe(0);
  });
  it("saves reviewed label nutrition once and isolates the private food", async () => {
    await asUser(alice);
    await db.exec(
      `insert into public.user_uploads(id,user_id,bucket,path,local_date,status) values('${meal}','${alice}','nutrition-labels','${alice}/${meal}.png','2026-09-06','ready')`,
    );
    const review = JSON.stringify({
      name: "Private bar",
      servingSize: 2,
      servingUnit: "pieces",
      servingGrams: 40,
      servingsPerContainer: 5,
      calories: 160,
      protein: 8,
      carbs: 20,
      fat: 5,
      fiber: 3,
      sugar: null,
      sodium: 100,
    });
    for (let i = 0; i < 3; i++)
      await db.query("select public.save_reviewed_label($1,$2,true)", [
        meal,
        review,
      ]);
    expect(
      (await db.query("select * from public.foods where user_id=auth.uid()"))
        .rows,
    ).toHaveLength(1);
    expect(
      Number(
        (
          await db.query<{ calories: number }>(
            `select calories from public.food_nutrition where food_id='${meal}'`,
          )
        ).rows[0].calories,
      ),
    ).toBe(400);
    await asUser(bob);
    expect(
      (await db.query(`select * from public.foods where id='${meal}'`)).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          `select * from public.food_nutrition where food_id='${meal}'`,
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        `insert into public.pantry_items(user_id,food_id,quantity_g) values('${bob}','${meal}',100)`,
      ),
    ).rejects.toThrow("not available");
  });
  it("requires confirmation before a label can create food", async () => {
    await asUser(alice);
    await expect(
      db.query("select public.save_reviewed_label($1,'{}',false)", [meal]),
    ).rejects.toThrow("Review and confirm");
  });
  it("keeps image buckets private and isolates both metadata and objects", async () => {
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets",
        )
      ).rows.every((b) => !b.public),
    ).toBe(true);
    await asUser(alice);
    await db.exec(
      `insert into public.user_uploads(id,user_id,bucket,path,local_date) values('${meal}','${alice}','progress-photos','${alice}/${meal}.png','2026-09-06');insert into storage.objects(bucket_id,name) values('progress-photos','${alice}/${meal}.png')`,
    );
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await asUser(bob);
    expect(await count("user_uploads")).toBe(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.exec(
        `insert into storage.objects(bucket_id,name) values('receipts','${alice}/forged.png')`,
      ),
    ).rejects.toThrow();
  });
  it("isolates body measurements and rejects empty records", async () => {
    await asUser(alice);
    await db.exec(
      `insert into public.body_measurements(user_id,local_date,waist) values('${alice}','2026-09-06',81.28)`,
    );
    expect(await count("body_measurements")).toBe(1);
    await asUser(bob);
    expect(await count("body_measurements")).toBe(0);
    await expect(
      db.exec(
        `insert into public.body_measurements(user_id,local_date,waist) values('${alice}','2026-09-07',90)`,
      ),
    ).rejects.toThrow();
  });
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
  it("honors a short future horizon and reserves stock for earlier meals", async () => {
    await db.exec(`update public.profiles set timezone='UTC' where id='${alice}';
      insert into public.pantry_items(user_id,food_id,quantity_g) values('${alice}','${food}',200);
      insert into public.daily_meal_logs(user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients)
      select '${alice}',current_date+n,'Lunch','Horizon',100,10,10,2,1,'[{"food_id":"${food}","quantity_g":150}]'::jsonb from generate_series(0,2)n;`);
    await asUser(alice);
    await db.exec(
      "select public.refresh_shopping_list(current_date+1,current_date+1);set constraints all immediate;set constraints all deferred;",
    );
    const row = (
      await db.query<{ amount: number; required_g: number; pantry_g: number }>(
        "select * from public.shopping_list_items where fulfillment='needed'",
      )
    ).rows[0];
    expect(Number(row.required_g)).toBe(150);
    expect(Number(row.pantry_g)).toBe(50);
    expect(Number(row.amount)).toBe(100);
    await db.exec("select public.reconcile_groceries();");
    expect(await count("shopping_list_items")).toBe(1);
  });
  it("automatically replenishes low/depleted stock and never duplicates active requirements", async () => {
    await db.exec(
      `insert into public.pantry_items(user_id,food_id,quantity_g) values('${alice}','${food}',100);insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('${meal}','${alice}',(now() at time zone 'America/Los_Angeles')::date,'Lunch','Test',100,10,10,1,1,'[{"food_id":"${food}","quantity_g":250}]');set constraints all immediate;set constraints all deferred;`,
    );
    await asUser(alice);
    const active = async () =>
      (
        await db.query<{ id: string; amount: number; updated_at: string }>(
          "select id,amount,updated_at from public.shopping_list_items where fulfillment='needed' and source='generated'",
        )
      ).rows;
    expect(Number((await active())[0].amount)).toBe(150);
    await db.query("select public.reconcile_groceries()");
    expect(await active()).toHaveLength(1);
    const first = (await active())[0];
    await db.query(
      "select public.mark_shopping_requirement($1,'already_have',$2)",
      [first.id, first.updated_at],
    );
    await db.query("select public.reconcile_groceries()");
    expect(await active()).toHaveLength(0);
    await db.exec(
      "update public.pantry_items set quantity_g=0;set constraints all immediate;set constraints all deferred;",
    );
    expect(Number((await active())[0].amount)).toBe(250);
    await db.exec(
      "update public.pantry_items set quantity_g=500;set constraints all immediate;set constraints all deferred;",
    );
    expect(await active()).toHaveLength(0);
    await db.exec(
      "update public.pantry_items set quantity_g=200;set constraints all immediate;set constraints all deferred;",
    );
    expect(Number((await active())[0].amount)).toBe(50);
    await asUser(bob);
    expect(await count("shopping_list_items")).toBe(0);
  });
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
  it("preserves Already Have It until stock or demand changes, without fabricating pantry", async () => {
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
      `select public.mark_shopping_requirement(id,'already_have',updated_at) from public.shopping_list_items;insert into public.shopping_list_items(user_id,list_id,name,amount,unit,source) values('${alice}','${first.list_id}','Paper towels',2,'piece','manual')`,
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

describe("Phase 6.5 shopping ledger", () => {
  const session = "71000000-0000-4000-8000-000000000001",
    item = "71000000-0000-4000-8000-000000000002",
    event = "71000000-0000-4000-8000-000000000003";
  async function setup() {
    await asUser(alice);
    await db.exec(
      `insert into public.shopping_lists(user_id,start_date,end_date) values('${alice}',current_date,current_date);insert into public.shopping_list_items(id,user_id,list_id,food_id,name,amount,unit,source) select '${item}','${alice}',id,'${food}','Test food',400,'g','manual' from public.shopping_lists;select public.start_shopping_session('${session}',null,null,'Test market','USD',(now() at time zone 'America/Los_Angeles')::date);`,
    );
  }
  async function buy(request = event) {
    await db.query(
      `select public.fulfill_shopping_item($1,$2,$3,(select updated_at from public.shopping_list_items where id=$3),null,null,1,'kg',4,'manual',null)`,
      [request, session, item],
    );
  }
  async function stock() {
    return Number(
      (
        await db.query<{ quantity_g: string }>(
          "select quantity_g from public.pantry_items",
        )
      ).rows[0]?.quantity_g || 0,
    );
  }
  async function spending() {
    return Number(
      (
        await db.query<{ total: string }>(
          "select total from public.purchase_months()",
        )
      ).rows[0]?.total || 0,
    );
  }
  it("purchases once across retries and distinct duplicate requests, including all leftover stock", async () => {
    await setup();
    await buy();
    await buy();
    await buy("71000000-0000-4000-8000-000000000004");
    expect(await stock()).toBe(1000);
    expect(await spending()).toBe(4);
    expect(await count("shopping_fulfillments")).toBe(1);
    expect(await count("purchase_items")).toBe(1);
    expect(
      (
        await db.query<{ fulfillment: string }>(
          "select fulfillment from public.shopping_list_items",
        )
      ).rows[0].fulfillment,
    ).toBe("purchased");
  });
  it("already-have is idempotent and changes neither inventory nor spending", async () => {
    await setup();
    await db.exec(
      `select public.mark_shopping_requirement('${item}','already_have',(select updated_at from public.shopping_list_items where id='${item}'));select public.mark_shopping_requirement('${item}','already_have',null);`,
    );
    expect(await stock()).toBe(0);
    expect(await spending()).toBe(0);
    expect(await count("purchase_items")).toBe(0);
  });
  it("undo and recheck are safe, and replay of the original request stays voided", async () => {
    await setup();
    await buy();
    await db.query("select public.undo_shopping_purchase($1)", [event]);
    await db.query("select public.undo_shopping_purchase($1)", [event]);
    expect(await stock()).toBe(0);
    expect(await spending()).toBe(0);
    await buy();
    expect(await stock()).toBe(0);
    await buy("71000000-0000-4000-8000-000000000004");
    expect(await stock()).toBe(1000);
    expect(await spending()).toBe(4);
  });
  it("corrects price without changing inventory", async () => {
    await setup();
    await buy();
    await db.query("select public.correct_shopping_purchase($1,5.25)", [event]);
    expect(await stock()).toBe(1000);
    expect(await spending()).toBe(5.25);
  });
  it("rolls back an invalid purchase with no partial receipt or stock", async () => {
    await setup();
    await db.exec("savepoint before_invalid");
    await expect(
      db.query(
        `select public.fulfill_shopping_item($1,$2,$3,(select updated_at from public.shopping_list_items where id=$3),null,null,1,'package',4,'manual',null)`,
        [event, session, item],
      ),
    ).rejects.toThrow("No reliable");
    await db.exec("rollback to savepoint before_invalid");
    expect(await stock()).toBe(0);
    expect(await count("purchase_items")).toBe(0);
    expect(await spending()).toBe(0);
  });
  it("refuses reversal after a related meal consumes stock", async () => {
    await setup();
    await buy();
    await db.exec(
      `insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('${meal}','${alice}',current_date,'Lunch','Test',100,10,10,2,1,'[{"food_id":"${food}","quantity_g":50}]');select public.set_meal_status('${meal}','completed');`,
    );
    await expect(
      db.query("select public.undo_shopping_purchase($1)", [event]),
    ).rejects.toThrow("already have been used");
  });
  it("prevents ordinary receipt deletion and stale generic edits bypassing stock", async () => {
    await setup();
    await buy();
    await db.exec("delete from public.purchases");
    expect(await count("purchases")).toBe(1);
    const p = (
      await db.query<{ id: string }>("select id from public.purchases")
    ).rows[0];
    await expect(
      db.query("select public.save_purchase($1,$2)", [
        JSON.stringify({ id: p.id }),
        JSON.stringify([]),
      ]),
    ).rejects.toThrow("shopping session");
  });
  it("blocks another user from reading or reversing a known purchase action", async () => {
    await setup();
    await buy();
    await asUser(bob);
    expect(await count("shopping_sessions")).toBe(0);
    expect(await count("shopping_fulfillments")).toBe(0);
    await expect(
      db.query("select public.undo_shopping_purchase($1)", [event]),
    ).rejects.toThrow("not found");
  });
  it("rejects direct purchased-state writes", async () => {
    await setup();
    await expect(
      db.exec("update public.shopping_list_items set purchased=true"),
    ).rejects.toThrow("permission denied");
  });
  it("protects an open cart from regeneration", async () => {
    await setup();
    await expect(
      db.exec(
        "select public.refresh_shopping_list((now() at time zone 'America/Los_Angeles')::date,(now() at time zone 'America/Los_Angeles')::date)",
      ),
    ).rejects.toThrow("Finish your shopping session");
  });
});

describe("independent preference edits", () => {
  async function profile() {
    await db.exec(
      `update public.profiles set onboarding_completed_at=now() where id='${alice}';insert into public.user_preferences(user_id,activity,workout_days,shopping_frequency,zip_code,shopping_preference,complexity,cooking_minutes,prep_frequency,meals_per_day,repeat_tolerance,disliked_foods) values('${alice}','light',3,'weekly','90210','balance',2,30,'weekly',3,'some',array['Peanuts']);`,
    );
    await asUser(alice);
  }
  it("edits cooking time without touching food preferences or onboarding", async () => {
    await profile();
    await db.query("select public.save_preference_section($1,$2,$3)", [
      "cooking",
      { cooking_minutes: 20 },
      { cooking_minutes: 30 },
    ]);
    const row = (
      await db.query<{ cooking_minutes: number; disliked_foods: string[] }>(
        "select * from public.user_preferences",
      )
    ).rows[0];
    expect(row.cooking_minutes).toBe(20);
    expect(row.disliked_foods).toEqual(["Peanuts"]);
    expect(
      (
        await db.query<{ onboarding_step: number }>(
          "select onboarding_step from public.profiles",
        )
      ).rows[0].onboarding_step,
    ).toBe(1);
  });
  it("preserves independent concurrent section changes", async () => {
    await profile();
    await db.query("select public.save_preference_section($1,$2,$3)", [
      "cooking",
      { cooking_minutes: 20 },
      { cooking_minutes: 30 },
    ]);
    await db.query("select public.save_preference_section($1,$2,$3)", [
      "foods",
      { disliked_foods: ["Tofu"] },
      { disliked_foods: ["Peanuts"] },
    ]);
    expect(
      (
        await db.query<{ cooking_minutes: number }>(
          "select cooking_minutes from public.user_preferences",
        )
      ).rows[0].cooking_minutes,
    ).toBe(20);
  });
  it("rejects stale section values", async () => {
    await profile();
    await expect(
      db.query("select public.save_preference_section($1,$2,$3)", [
        "cooking",
        { cooking_minutes: 20 },
        { cooking_minutes: 10 },
      ]),
    ).rejects.toThrow("changed");
  });
  it("applies Canadian metric defaults and keeps other profile fields", async () => {
    await profile();
    await db.query("select public.save_preference_section($1,$2,$3)", [
      "units",
      { country_code: "CA", display_units_override: null },
      { country_code: "US", display_units_override: null },
    ]);
    expect(
      (await db.query<{ units: string }>("select units from public.profiles"))
        .rows[0].units,
    ).toBe("metric");
  });
  it("rejects injecting unrelated fields into a section", async () => {
    await profile();
    await expect(
      db.query("select public.save_preference_section($1,$2,$3)", [
        "cooking",
        { disliked_foods: [] },
        { disliked_foods: ["Peanuts"] },
      ]),
    ).rejects.toThrow("Unexpected");
  });
  it("prevents resubmitting onboarding after completion", async () => {
    await profile();
    await expect(
      db.query("select public.save_onboarding($1)", [{}]),
    ).rejects.toThrow("Use Preferences");
  });
});
