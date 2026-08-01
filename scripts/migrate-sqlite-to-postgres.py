#!/usr/bin/env python3
"""
Migración: SQLite (local) → PostgreSQL (Neon)
Versión 2: ordena tablas topológicamente por dependencias FK.

Lee todos los datos de /home/z/my-project/db/custom.db (SQLite) y los inserta
en PostgreSQL de Neon respetando el orden de FKs.
"""
import os
import sys
import json
import sqlite3
import psycopg2
import psycopg2.extras
from datetime import datetime, date
from decimal import Decimal
from collections import defaultdict, deque

SQLITE_PATH = '/home/z/my-project/db/custom.db'

# Load DATABASE_URL from .env
DB_URL = None
with open('/home/z/my-project/.env') as f:
    for line in f:
        line = line.strip()
        if line.startswith('DATABASE_URL='):
            val = line.split('=', 1)[1]
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1]
            DB_URL = val
            break

if not DB_URL:
    print('❌ DATABASE_URL not found in .env')
    sys.exit(1)

print(f'✓ DATABASE_URL: {DB_URL.split("@")[1].split("/")[0]}@***')
print()

# === Connect ===
print('=== Connecting to SQLite ===')
sqlite = sqlite3.connect(SQLITE_PATH, uri=True)
sqlite.row_factory = sqlite3.Row
print('✓ SQLite connected')

print('=== Connecting to PostgreSQL (Neon) ===')
pg = psycopg2.connect(DB_URL)
pg.autocommit = False
print('✓ PostgreSQL connected')

# === Discover tables in both DBs ===
scur = sqlite.cursor()
scur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name")
sqlite_tables = [r[0] for r in scur.fetchall()]

pcur = pg.cursor()
pcur.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
""")
pg_tables = [r[0] for r in pcur.fetchall()]

tables_to_migrate = [t for t in sqlite_tables if t in pg_tables]
print(f'Tables to migrate: {len(tables_to_migrate)}')

# === Get FK dependencies (topological sort) ===
print()
print('=== Building FK dependency graph ===')
pcur.execute("""
    SELECT 
        tc.table_name AS child,
        kcu.table_name AS parent,
        ccu.table_name AS references_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
""")
# child depends on parent (referenced table)
deps = defaultdict(set)
for row in pcur.fetchall():
    child = row[0]
    parent = row[2]  # references_table is the parent (referenced) table
    if child != parent:  # skip self-references
        deps[child].add(parent)

print(f'FK dependencies found: {sum(len(v) for v in deps.values())}')

# === Topological sort (Kahn's algorithm) ===
def topo_sort(tables, deps):
    # Build in-degree map
    in_degree = {t: 0 for t in tables}
    adjacency = defaultdict(set)  # parent -> set of children
    for child, parents in deps.items():
        if child not in in_degree:
            continue
        for parent in parents:
            if parent in in_degree:
                adjacency[parent].add(child)
                in_degree[child] += 1
    
    # Start with tables that have no deps
    queue = deque([t for t in tables if in_degree[t] == 0])
    sorted_tables = []
    while queue:
        t = queue.popleft()
        sorted_tables.append(t)
        for child in sorted(adjacency[t]):
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)
    
    # Handle cycles: append remaining tables
    remaining = [t for t in tables if t not in sorted_tables]
    if remaining:
        print(f'  ⚠️  {len(remaining)} tables in cycles, appending at end')
        sorted_tables.extend(remaining)
    
    return sorted_tables

ordered_tables = topo_sort(tables_to_migrate, deps)
print(f'Topologically sorted: {len(ordered_tables)} tables')

# === Get PG columns for each table ===
def get_pg_columns(table_name):
    pcur = pg.cursor()
    pcur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    return [(r[0], r[1]) for r in pcur.fetchall()]

# === Convert SQLite value to PostgreSQL-compatible value ===
def convert_value(value, pg_type):
    if value is None:
        return None
    if pg_type == 'boolean':
        if isinstance(value, bool):
            return value
        if isinstance(value, int):
            return bool(value)
        if isinstance(value, str):
            return value.lower() in ('true', '1', 't')
        return bool(value)
    if pg_type in ('jsonb', 'json'):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (json.JSONDecodeError, ValueError):
                return value
        return value
    if pg_type == 'bytea':
        if isinstance(value, str):
            return value.encode('utf-8')
        return value
    if pg_type == 'numeric':
        if isinstance(value, str):
            try:
                return Decimal(value)
            except:
                return value
        return value
    # Timestamps: SQLite stores as Unix epoch (ms or s) or ISO string
    if pg_type in ('timestamp without time zone', 'timestamp with time zone'):
        if value is None:
            return None
        if isinstance(value, (int, float)):
            # Detect ms vs s: ms epoch > 1e11 (year 5138 in seconds), s epoch < 1e11
            try:
                if value > 1e11:
                    # Milliseconds
                    dt = datetime.fromtimestamp(value / 1000.0)
                else:
                    # Seconds
                    dt = datetime.fromtimestamp(value)
                return dt
            except (ValueError, OSError, OverflowError):
                return None
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None
            # Numeric string (epoch)
            if stripped.isdigit() or (stripped.startswith('-') and stripped[1:].isdigit()):
                try:
                    num = int(stripped)
                    if num > 1e11:
                        return datetime.fromtimestamp(num / 1000.0)
                    else:
                        return datetime.fromtimestamp(num)
                except (ValueError, OSError, OverflowError):
                    return None
            # Try parsing as ISO string
            try:
                return datetime.fromisoformat(stripped.replace('Z', '+00:00'))
            except ValueError:
                for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%d'):
                    try:
                        return datetime.strptime(stripped, fmt)
                    except ValueError:
                        continue
                return value
        if isinstance(value, (datetime, date)):
            return value
    if pg_type == 'bigint':
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return value
    return value

# === Migrate each table in topological order ===
print()
print('=== Migrating tables (in FK dependency order) ===')
print()

stats = {'migrated': 0, 'skipped': 0, 'errors': 0, 'total_records': 0}
errors_log = []
failed_tables = set()

for table_name in ordered_tables:
    try:
        # Get PG columns
        columns = get_pg_columns(table_name)
        col_names = [c[0] for c in columns]
        col_types = {c[0]: c[1] for c in columns}
        if not col_names:
            print(f'  ⚠️  {table_name}: no PG columns, skip')
            stats['skipped'] += 1
            failed_tables.add(table_name)
            continue
        
        # Get SQLite columns
        scur.execute(f'PRAGMA table_info("{table_name}")')
        sqlite_cols = [r[1] for r in scur.fetchall()]
        use_cols = [c for c in col_names if c in sqlite_cols]
        if not use_cols:
            print(f'  ⚠️  {table_name}: no common columns, skip')
            stats['skipped'] += 1
            failed_tables.add(table_name)
            continue
        
        # Read from SQLite
        cols_csv = ', '.join(f'"{c}"' for c in use_cols)
        scur.execute(f'SELECT {cols_csv} FROM "{table_name}"')
        rows = scur.fetchall()
        
        if not rows:
            print(f'  • {table_name}: 0 records (skip)')
            stats['migrated'] += 1
            continue
        
        # Truncate PG table
        pcur2 = pg.cursor()
        pcur2.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY CASCADE;')
        
        # Build INSERT for execute_values (single %s placeholder)
        insert_sql = f'INSERT INTO "{table_name}" ({cols_csv}) VALUES %s'
        
        # Batch insert
        batch_size = 100
        total_inserted = 0
        for batch_start in range(0, len(rows), batch_size):
            batch = rows[batch_start:batch_start + batch_size]
            values_batch = []
            for row in batch:
                row_dict = {k: row[k] for k in use_cols}
                values_batch.append([convert_value(row_dict[c], col_types[c]) for c in use_cols])
            
            psycopg2.extras.execute_values(pcur2, insert_sql, values_batch, page_size=100, template=f"({','.join(['%s']*len(use_cols))})")
            total_inserted += len(batch)
        
        pg.commit()
        stats['total_records'] += total_inserted
        print(f'  ✓ {table_name}: {total_inserted} records')
        stats['migrated'] += 1
        
    except Exception as e:
        pg.rollback()
        err_msg = f'{table_name}: {str(e)[:200]}'
        errors_log.append(err_msg)
        print(f'  ❌ {err_msg}')
        stats['errors'] += 1
        failed_tables.add(table_name)

# === Retry failed tables (in case FK ordering wasn't perfect) ===
if failed_tables:
    print()
    print(f'=== Retrying {len(failed_tables)} failed tables ===')
    for table_name in [t for t in ordered_tables if t in failed_tables]:
        try:
            columns = get_pg_columns(table_name)
            col_names = [c[0] for c in columns]
            col_types = {c[0]: c[1] for c in columns}
            scur.execute(f'PRAGMA table_info("{table_name}")')
            sqlite_cols = [r[1] for r in scur.fetchall()]
            use_cols = [c for c in col_names if c in sqlite_cols]
            if not use_cols:
                continue
            
            cols_csv = ', '.join(f'"{c}"' for c in use_cols)
            scur.execute(f'SELECT {cols_csv} FROM "{table_name}"')
            rows = scur.fetchall()
            
            if not rows:
                continue
            
            pcur2 = pg.cursor()
            pcur2.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY CASCADE;')
            insert_sql = f'INSERT INTO "{table_name}" ({cols_csv}) VALUES %s'
            
            batch_size = 100
            total_inserted = 0
            for batch_start in range(0, len(rows), batch_size):
                batch = rows[batch_start:batch_start + batch_size]
                values_batch = []
                for row in batch:
                    row_dict = {k: row[k] for k in use_cols}
                    values_batch.append([convert_value(row_dict[c], col_types[c]) for c in use_cols])
                psycopg2.extras.execute_values(pcur2, insert_sql, values_batch, page_size=100, template=f"({','.join(['%s']*len(use_cols))})")
                total_inserted += len(batch)
            
            pg.commit()
            stats['total_records'] += total_inserted
            print(f'  ✓ {table_name}: {total_inserted} records (retry OK)')
            stats['migrated'] += 1
            stats['errors'] -= 1
            failed_tables.discard(table_name)
        except Exception as e:
            pg.rollback()
            print(f'  ❌ {table_name} retry failed: {str(e)[:150]}')

# === Verification ===
print()
print('=== Verification ===')
discrepancies = 0
for table_name in tables_to_migrate:
    try:
        scur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
        sqlite_count = scur.fetchone()[0]
        pcur3 = pg.cursor()
        pcur3.execute(f'SELECT COUNT(*) FROM "{table_name}"')
        pg_count = pcur3.fetchone()[0]
        if sqlite_count != pg_count:
            print(f'  ⚠️  {table_name}: SQLite={sqlite_count} PG={pg_count} MISMATCH')
            discrepancies += 1
    except Exception as e:
        print(f'  ❌ {table_name}: verify error: {str(e)[:100]}')

# === Summary ===
print()
print('=' * 60)
print('=== MIGRATION SUMMARY ===')
print('=' * 60)
print(f'  Tables migrated:    {stats["migrated"]}')
print(f'  Tables skipped:     {stats["skipped"]}')
print(f'  Tables with errors: {stats["errors"]}')
print(f'  Total records:      {stats["total_records"]}')
print(f'  Count mismatches:   {discrepancies}')
if errors_log:
    print()
    print('Errors:')
    for e in errors_log:
        print(f'  - {e}')

sqlite.close()
pg.close()

print()
print('✓ Migration complete' if stats['errors'] == 0 else f'⚠️  Migration completed with {stats["errors"]} errors')
sys.exit(0 if stats['errors'] == 0 else 1)
