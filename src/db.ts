import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { UserData } from './types';

interface TableSchema {
    schema: {
        [key: string]: 'INTEGER' | 'TEXT' | 'TEXT_ARRAY' | 'BOOLEAN' | string; // Support TEXT_ARRAY type
    };
}

interface DbConfig {
    dbDir: string;
    dbName: string;
    tables: {
        [key: string]: TableSchema;
    };
}

export class Database {
    private static instance: Database | null = null;
    private db: any;
    private config: DbConfig;

    private constructor() {
        // Read configuration file
        const configPath = path.join(__dirname, '..', 'config', 'db.schema.yaml');
        const configContent = fs.readFileSync(configPath, 'utf8');
        this.config = yaml.load(configContent) as DbConfig;

        // Ensure database directory exists
        const dbDir = path.join(__dirname, '..', this.config.dbDir);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    public static async getInstance(): Promise<Database> {
        if (!Database.instance) {
            Database.instance = new Database();
            await Database.instance.initDatabase();
        }
        return Database.instance;
    }

    private async initDatabase() {
        const dbPath = path.join(__dirname, '..', this.config.dbDir, this.config.dbName);
        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Create or update tables
        for (const [tableName, tableConfig] of Object.entries(this.config.tables)) {
            // Check if table exists
            const tableExists = await this.db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                tableName
            );

            if (!tableExists) {
                // If table doesn't exist, create new table
                const schema = tableConfig.schema;
                const columns = Object.entries(schema)
                    .map(([columnName, columnType]) => {
                        const sqliteType = columnType === 'TEXT_ARRAY' ? 'TEXT' : columnType;
                        return `${columnName} ${sqliteType}`;
                    })
                    .join(', ');

                const createTableSql = `CREATE TABLE ${tableName} (${columns})`;
                await this.db.exec(createTableSql);
            } else {
                // If table exists, check and add missing columns
                const schema = tableConfig.schema;
                const existingColumns = await this.db.all(`PRAGMA table_info(${tableName})`);
                const existingColumnNames = existingColumns.map(col => col.name);

                for (const [columnName, columnType] of Object.entries(schema)) {
                    if (!existingColumnNames.includes(columnName)) {
                        const sqliteType = columnType === 'TEXT_ARRAY' ? 'TEXT' : columnType;
                        const alterTableSql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqliteType}`;
                        await this.db.exec(alterTableSql);
                    }
                }
            }
        }
    }

    public getPrimaryKey(tableName: string): string {
        const schema = this.config.tables[tableName].schema;
        for (const [columnName, columnType] of Object.entries(schema)) {
            if (columnType.includes('PRIMARY KEY')) {
                return columnName;
            }
        }
        throw new Error(`No primary key found for table ${tableName}`);
    }

    // Serialize field values
    private serializeData(tableName: string, data: Record<string, any>): Record<string, any> {
        return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [
                key, this.serializeField(tableName, key, value)
            ])
        );
    }
    private serializeField(tableName: string, columnName: string, value: any): any {
        const schema = this.config.tables[tableName].schema;
        const columnType = schema[columnName];
        if (columnType === 'TEXT_ARRAY') {
            if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
                throw new Error(`Field '${columnName}' in table '${tableName}' must be a string array`);
            }
            return JSON.stringify(value);
        }
        return value;
    }

    // Deserialize field values
    private deserializedata(tableName: string, data: Record<string, any>): Record<string, any> {
        return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [
                key, this.deserializeField(tableName, key, value)
            ])
        );
    }
    private deserializeField(tableName: string, columnName: string, value: any): any {
        const schema = this.config.tables[tableName].schema;
        const columnType = schema[columnName];
        if (columnType === 'TEXT_ARRAY' && typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (e) {
                throw new Error(`Failed to parse TEXT_ARRAY field '${columnName}' in table '${tableName}': ${e.message}`);
            }
        }
        return value;
    }

    public async read_item<T>(tableName: string, primaryValue: string): Promise<T | null> {
        const primaryKey = this.getPrimaryKey(tableName);
        const sql = `SELECT * FROM ${tableName} WHERE ${primaryKey} = ?`;
        const result = await this.db.get(sql, primaryValue);

        if (!result) return null;

        // Deserialize based on schema type
        const deserializedResult = this.deserializedata(tableName, result);
        return deserializedResult as T;
    }

    public async write(tableName: string, primaryValue: string, data: Record<string, any>): Promise<void> {
        const serializedData = this.serializeData(tableName, data);
        const primaryKey = this.getPrimaryKey(tableName);
        if (primaryValue) {//Specify primary key
            const existingRecord = await this.read_item(tableName, primaryValue);
            if (existingRecord) {
                // Update existing record
                const setClause = Object.keys(serializedData)
                    .map(key => `${key} = ?`)
                    .join(', ');
                const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey} = ?`;
                const values = [...Object.values(serializedData), primaryValue];
                await this.db.run(sql, values);
            } else {
                // Insert new record
                const columns = [primaryKey, ...Object.keys(serializedData)];
                const placeholders = new Array(columns.length).fill('?').join(', ');
                const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                const values = [primaryValue, ...Object.values(serializedData)];
                await this.db.run(sql, values);
            }
        } else {//No primary key specified
            // Insert new record
            const columns = Object.keys(serializedData).filter(key => key !== primaryKey);
            const placeholders = new Array(columns.length).fill('?').join(', ');
            const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
            const values = columns.map(col => serializedData[col]);
            await this.db.run(sql, values);
        }
    }

    public async find_items<T>(tableName: string, query: Record<string, any>, limit: number = 1000): Promise<T[]> {
        let limit_sql = "";
        if (limit || limit !== 0) {
            limit_sql = `LIMIT ${limit}`;
        }
        const sql = `SELECT * FROM ${tableName} WHERE ${Object.keys(query).map(key => `${key} = ?`).join(' AND ')} ${limit_sql}`;
        const values = Object.values(query);
        const results = await this.db.all(sql, values);
        return results.map(row => this.deserializedata(tableName, row)) as T[];
    }

    public async find_items_with_column<T>(tableName: string, query: Record<string, any>, column:string, limit: number,order:{key:string,type:"ASC"|"DESC"}|undefined): Promise<T[]> {
        let where = '';
        let return_columns = '*';
        let limit_sql = '';
        let order_sql = '';
        if (query && query.length > 0) {
            where = `WHERE ${Object.keys(query).map(key => `${key} = ?`).join(' AND ')}`;
        }
        if (column){
            return_columns = column;
        }
        if (limit || limit === 0){
            limit_sql = `LIMIT ${limit}`;
        }
        if (order) {
            const { key, type } = order;
            order_sql = `ORDER BY ${key} ${type}`;
        }
        const sql = `SELECT ${return_columns} FROM ${tableName} ${where} ${order_sql} ${limit_sql}`;
        if(query && query.length > 0){
            const values = Object.values(query);
            const results = await this.db.all(sql, values);
            return results.map(row => this.deserializedata(tableName, row)) as T[];
        }else{
            const results = await this.db.all(sql);
            return results.map(row => this.deserializedata(tableName, row)) as T[];
        }
    }

    public async write_batch(tableName: string, primaryValues: (string[] | undefined | null), data: Record<string, any>[]): Promise<void> {
        if (data.length === 0) return;
        const primaryKey = this.getPrimaryKey(tableName);

        // Serialize data (handle TEXT_ARRAY etc special types)
        const serializedData = data.map(item => this.serializeData(tableName, item));
        const columns = Object.keys(serializedData[0]);

        // Start transaction
        await this.db.run('BEGIN TRANSACTION');

        try {
            if (primaryValues) {
                // Use UPSERT to implement batch update or insert
                const placeholders = columns.map(() => '?').join(', ');
                const updateClause = columns
                    .filter(col => col !== primaryKey) // Don't update primary key
                    .map(col => `${col} = excluded.${col}`)
                    .join(', ');

                const sql = `
                    INSERT INTO ${tableName} (${columns.join(', ')})
                    VALUES (${placeholders})
                    ON CONFLICT(${primaryKey}) DO UPDATE SET ${updateClause}
                `;

                const stmt = await this.db.prepare(sql);
                for (let i = 0; i < primaryValues.length; i++) {
                    const values = [primaryValues[i], ...Object.values(serializedData[i]).filter((_, idx) => columns[idx] !== primaryKey)];
                    await stmt.run(...values);
                }
                await stmt.finalize();
            } else {
                const insertColumns = columns.filter(col => col !== primaryKey);
                const placeholders = insertColumns.map(() => '?').join(', ');
                const sql = `
                    INSERT INTO ${tableName} (${insertColumns.join(', ')})
                    VALUES (${placeholders})
                `;

                const stmt = await this.db.prepare(sql);
                for (let i = 0; i < data.length; i++) {
                    const values = insertColumns.map(col => serializedData[i][col]);
                    await stmt.run(...values);
                }
                await stmt.finalize();
            }

            // Commit transaction
            await this.db.run('COMMIT');
        } catch (error) {
            // Rollback on error
            await this.db.run('ROLLBACK');
            throw new Error(`Batch write failed: ${error.message}`);
        }
    }

    public async delete_items(tableName: string, primaryValues: string[]): Promise<void> {
        const primaryKey = this.getPrimaryKey(tableName);
        const sql = `DELETE FROM ${tableName} WHERE ${primaryKey} IN (${primaryValues.map(() => '?').join(', ')})`;
        await this.db.run(sql, ...primaryValues);
    }

    public async get_all_tables(): Promise<string[]> {
        const tables = await this.db.all("SELECT name FROM sqlite_master WHERE type='table'");
        return tables.map(table => table.name);
    }

    public async dropTable(tableName: string): Promise<void> {
        // Check if table exists
        const checkSql = `SELECT name FROM sqlite_master WHERE type='table' AND name=?`;
        const existingTable = await this.db.get(checkSql, tableName);

        if (!existingTable) {
            throw new Error(`Table ${tableName} does not exist`);
        }

        // Drop table
        const dropTableSql = `DROP TABLE ${tableName}`;
        await this.db.exec(dropTableSql);
    }

    // TODO function: Create table with specified name, table content from db.schema.yaml
    public async createTable(tableName: string): Promise<void> {
        // Check if table exists
        const checkSql = `SELECT name FROM sqlite_master WHERE type='table' AND name=?`;
        const existingTable = await this.db.get(checkSql, tableName);

        if (existingTable) {
            throw new Error(`Table ${tableName} already exists`);
        }

        // Get table structure from configuration
        const tableConfig = this.config.tables[tableName];
        if (!tableConfig) {
            throw new Error(`Table schema not found for ${tableName} in configuration`);
        }

        const schema = tableConfig.schema;
        const columns = Object.entries(schema)
            .map(([columnName, columnType]) => {
                const sqliteType = columnType === 'TEXT_ARRAY' ? 'TEXT' : columnType;
                return `${columnName} ${sqliteType}`;
            })
            .join(', ');

        // Create table
        const createTableSql = `CREATE TABLE ${tableName} (${columns})`;
        await this.db.exec(createTableSql);
    }

    public async get_unparsed_user(): Promise<UserData|undefined> {
        const tableName = 'user';
        const sql = `
            SELECT u.* 
            FROM user u 
            LEFT JOIN user_extend ue ON u.id = ue.id 
            WHERE ue.id IS NULL 
            LIMIT 1
        `;
        
        const results = await this.db.all(sql);
        if (results.length === 0) {
            return undefined;
        }
        return this.deserializedata(tableName, results[0]) as UserData;
    }

    public async get_unparsed_project(): Promise<UserData|undefined> {
        const tableName = 'user';
        const sql = `
            SELECT u.* 
            FROM user u 
            JOIN user_extend ue ON u.id = ue.id 
            LEFT JOIN project p ON u.id = p.id
            WHERE ue.user_type = 'project' AND p.id IS NULL
            ORDER BY ue.ai_percent DESC
            LIMIT 1
        `;
        
        const results = await this.db.all(sql);
        if (results.length === 0) {
            return undefined;
        }
        return this.deserializedata(tableName, results[0]) as UserData;
    }
}
