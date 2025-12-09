import * as fs from 'fs';
import * as path from 'path';

/**
 * Database Integration Module
 * Handles database migrations, connection strings, initialization, and health checks
 * 
 * Errors Fixed:
 * - Error #26: Migrations handling (detection and integration)
 * - Error #27: Connection strings (generation and parsing)
 * - Error #28: Database initialization (scripts and setup)
 * - Error #29: Data persistence (volumes and mounts)
 * - Error #30: Health checks (database-specific checks)
 */

// ==================== INTERFACES ====================

export interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite' | 'mariadb' | 'oracle' | 'mssql';
  version?: string;
  port: number;
  host: string;
  username?: string;
  password?: string;
  database?: string;
  connectionString?: string;
  migrationsPath?: string;
  seedsPath?: string;
  initScripts?: string[];
  healthCheck?: HealthCheckConfig;
  persistence?: PersistenceConfig;
}

export interface MigrationInfo {
  tool: 'typeorm' | 'sequelize' | 'knex' | 'prisma' | 'liquibase' | 'flyway' | 'alembic' | 'none';
  path: string;
  pending: string[];
  completed: string[];
  currentVersion?: string;
}

export interface ConnectionStringConfig {
  protocol: string;
  username?: string;
  password?: string;
  host: string;
  port: number;
  database?: string;
  options?: { [key: string]: string };
}

export interface HealthCheckConfig {
  command: string;
  interval: number; // seconds
  timeout: number; // seconds
  retries: number;
  startPeriod: number; // seconds
}

export interface PersistenceConfig {
  enabled: boolean;
  volumeName: string;
  mountPath: string;
  backupStrategy?: 'daily' | 'weekly' | 'monthly';
}

// ==================== DATABASE DETECTOR ====================

export class DatabaseDetector {
  /**
   * Error #26: Detect migration tools and configurations
   */
  static detectMigrations(projectPath: string): MigrationInfo {
    const migrationTool = this.detectMigrationTool(projectPath);
    const migrationsPath = this.findMigrationsPath(projectPath, migrationTool);
    const { pending, completed, currentVersion } = this.analyzeMigrations(migrationsPath, migrationTool);

    return {
      tool: migrationTool,
      path: migrationsPath,
      pending,
      completed,
      currentVersion
    };
  }

  private static detectMigrationTool(projectPath: string): MigrationInfo['tool'] {
    const packageJsonPath = path.join(projectPath, 'package.json');
    let packageJson: any = {};

    try {
      if (fs.existsSync(packageJsonPath)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      }
    } catch (e) {}

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for TypeORM
    if (deps.typeorm || fs.existsSync(path.join(projectPath, 'ormconfig.js')) ||
        fs.existsSync(path.join(projectPath, 'ormconfig.json'))) {
      return 'typeorm';
    }

    // Check for Sequelize
    if (deps.sequelize || fs.existsSync(path.join(projectPath, '.sequelizerc'))) {
      return 'sequelize';
    }

    // Check for Knex
    if (deps.knex || fs.existsSync(path.join(projectPath, 'knexfile.js'))) {
      return 'knex';
    }

    // Check for Prisma
    if (deps.prisma || fs.existsSync(path.join(projectPath, 'prisma', 'schema.prisma'))) {
      return 'prisma';
    }

    // Check for Liquibase
    if (fs.existsSync(path.join(projectPath, 'src', 'main', 'resources', 'db', 'changelog'))) {
      return 'liquibase';
    }

    // Check for Flyway
    if (fs.existsSync(path.join(projectPath, 'src', 'main', 'resources', 'db', 'migration'))) {
      return 'flyway';
    }

    // Check for Alembic (Python)
    if (fs.existsSync(path.join(projectPath, 'alembic'))) {
      return 'alembic';
    }

    return 'none';
  }

  private static findMigrationsPath(projectPath: string, tool: MigrationInfo['tool']): string {
    const commonPaths = [
      path.join(projectPath, 'migrations'),
      path.join(projectPath, 'db', 'migrations'),
      path.join(projectPath, 'src', 'migrations'),
      path.join(projectPath, 'src', 'db', 'migrations'),
      path.join(projectPath, 'database', 'migrations'),
    ];

    if (tool === 'typeorm') {
      commonPaths.push(path.join(projectPath, 'src', 'database', 'migrations'));
    } else if (tool === 'sequelize') {
      commonPaths.push(path.join(projectPath, 'migrations'));
    } else if (tool === 'knex') {
      commonPaths.push(path.join(projectPath, 'knex_migrations'));
    } else if (tool === 'prisma') {
      return path.join(projectPath, 'prisma', 'migrations');
    }

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return path.join(projectPath, 'migrations');
  }

  private static analyzeMigrations(migrationsPath: string, tool: MigrationInfo['tool']): {
    pending: string[];
    completed: string[];
    currentVersion?: string;
  } {
    const pending: string[] = [];
    const completed: string[] = [];

    try {
      if (!fs.existsSync(migrationsPath)) {
        return { pending, completed };
      }

      const files = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.sql'))
        .sort();

      // Simple heuristic: assume files with down/undo are pending
      for (const file of files) {
        if (file.includes('undo') || file.includes('down') || file.includes('rollback')) {
          pending.push(file);
        } else {
          completed.push(file);
        }
      }
    } catch (e) {}

    return { pending, completed };
  }
}

// ==================== CONNECTION STRING GENERATOR (Error #27) ====================

export class ConnectionStringGenerator {
  /**
   * Error #27: Generate database connection strings
   */
  static generateConnectionString(config: DatabaseConfig): string {
    if (config.connectionString) {
      return config.connectionString;
    }

    switch (config.type) {
      case 'postgresql':
        return this.generatePostgresConnectionString(config);
      case 'mysql':
      case 'mariadb':
        return this.generateMysqlConnectionString(config);
      case 'mongodb':
        return this.generateMongoConnectionString(config);
      case 'redis':
        return this.generateRedisConnectionString(config);
      case 'sqlite':
        return this.generateSqliteConnectionString(config);
      case 'oracle':
        return this.generateOracleConnectionString(config);
      case 'mssql':
        return this.generateMssqlConnectionString(config);
      default:
        return '';
    }
  }

  private static generatePostgresConnectionString(config: DatabaseConfig): string {
    const user = config.username || 'postgres';
    const password = config.password ? `:${config.password}` : '';
    const database = config.database || 'postgres';
    const port = config.port || 5432;

    return `postgresql://${user}${password}@${config.host}:${port}/${database}`;
  }

  private static generateMysqlConnectionString(config: DatabaseConfig): string {
    const user = config.username || 'root';
    const password = config.password ? `:${config.password}` : '';
    const database = config.database || 'mysql';
    const port = config.port || 3306;

    return `mysql://${user}${password}@${config.host}:${port}/${database}`;
  }

  private static generateMongoConnectionString(config: DatabaseConfig): string {
    const user = config.username ? `${config.username}:${config.password}@` : '';
    const database = config.database || 'test';
    const port = config.port || 27017;

    return `mongodb://${user}${config.host}:${port}/${database}`;
  }

  private static generateRedisConnectionString(config: DatabaseConfig): string {
    const password = config.password ? `:${config.password}@` : '';
    const port = config.port || 6379;

    return `redis://${password}${config.host}:${port}`;
  }

  private static generateSqliteConnectionString(config: DatabaseConfig): string {
    return `sqlite:///${config.database || './data.db'}`;
  }

  private static generateOracleConnectionString(config: DatabaseConfig): string {
    const user = config.username || 'system';
    const password = config.password || 'oracle';
    const database = config.database || 'ORCLCDB';
    const port = config.port || 1521;

    return `oracle://${user}:${password}@${config.host}:${port}/${database}`;
  }

  private static generateMssqlConnectionString(config: DatabaseConfig): string {
    const user = config.username || 'sa';
    const password = config.password || 'password';
    const database = config.database || 'master';
    const port = config.port || 1433;

    return `mssql://${user}:${password}@${config.host}:${port}/${database}`;
  }

  /**
   * Parse connection string into config
   */
  static parseConnectionString(connectionString: string): ConnectionStringConfig {
    try {
      const url = new URL(connectionString);
      
      return {
        protocol: url.protocol.replace(':', ''),
        username: url.username || undefined,
        password: url.password || undefined,
        host: url.hostname,
        port: parseInt(url.port) || this.getDefaultPort(url.protocol),
        database: url.pathname.replace('/', '') || undefined,
        options: Object.fromEntries(url.searchParams)
      };
    } catch (e) {
      return {
        protocol: 'unknown',
        host: 'localhost',
        port: 5432
      };
    }
  }

  private static getDefaultPort(protocol: string): number {
    const ports: { [key: string]: number } = {
      'postgresql:': 5432,
      'mysql:': 3306,
      'mongodb:': 27017,
      'redis:': 6379,
      'oracle:': 1521,
      'mssql:': 1433
    };
    return ports[protocol] || 5432;
  }
}

// ==================== DATABASE INITIALIZER (Error #28) ====================

export class DatabaseInitializer {
  /**
   * Error #28: Generate database initialization scripts
   */
  static generateInitScript(config: DatabaseConfig): string {
    switch (config.type) {
      case 'postgresql':
        return this.generatePostgresInit(config);
      case 'mysql':
      case 'mariadb':
        return this.generateMysqlInit(config);
      case 'mongodb':
        return this.generateMongoInit(config);
      case 'redis':
        return this.generateRedisInit(config);
      default:
        return '';
    }
  }

  private static generatePostgresInit(config: DatabaseConfig): string {
    const db = config.database || 'postgres';
    const user = config.username || 'postgres';

    return `#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "${user}" <<-EOSQL
  CREATE DATABASE ${db};
  GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${user};
EOSQL
`;
  }

  private static generateMysqlInit(config: DatabaseConfig): string {
    const db = config.database || 'mysql';
    const user = config.username || 'root';

    return `#!/bin/bash
mysql -u${user} -p"$MYSQL_ROOT_PASSWORD" <<-EOSQL
  CREATE DATABASE IF NOT EXISTS ${db};
  GRANT ALL PRIVILEGES ON ${db}.* TO '${user}'@'%';
  FLUSH PRIVILEGES;
EOSQL
`;
  }

  private static generateMongoInit(config: DatabaseConfig): string {
    const db = config.database || 'test';
    const user = config.username || 'root';
    const password = config.password || 'password';

    return `#!/bin/bash
mongo admin <<-EOSQL
  db.createUser({
    user: "${user}",
    pwd: "${password}",
    roles: ["root"]
  });
  db.createCollection("init");
EOSQL
`;
  }

  private static generateRedisInit(_config: DatabaseConfig): string {
    return `#!/bin/bash
# Redis initialization
redis-cli PING
`;
  }
}

// ==================== DATA PERSISTENCE MANAGER (Error #29) ====================

export class DataPersistenceManager {
  /**
   * Error #29: Configure data persistence with volumes
   */
  static generatePersistenceConfig(config: DatabaseConfig): PersistenceConfig {
    const volumeName = `${config.type}-data-${Date.now()}`;
    const mountPath = this.getMountPath(config.type);

    return {
      enabled: true,
      volumeName,
      mountPath,
      backupStrategy: 'daily'
    };
  }

  private static getMountPath(dbType: string): string {
    const paths: { [key: string]: string } = {
      'postgresql': '/var/lib/postgresql/data',
      'mysql': '/var/lib/mysql',
      'mariadb': '/var/lib/mysql',
      'mongodb': '/data/db',
      'redis': '/data',
      'sqlite': '/app/data',
      'oracle': '/u01/oradata',
      'mssql': '/var/opt/mssql'
    };

    return paths[dbType] || '/data';
  }

  /**
   * Generate docker-compose volume configuration
   */
  static generateVolumeConfig(persistence: PersistenceConfig): {
    volumes: { [key: string]: {} };
    volumeMounts: { [key: string]: string };
  } {
    return {
      volumes: {
        [persistence.volumeName]: {}
      },
      volumeMounts: {
        [persistence.volumeName]: persistence.mountPath
      }
    };
  }

  /**
   * Generate backup configuration
   */
  static generateBackupScript(config: DatabaseConfig, persistence: PersistenceConfig): string {
    switch (config.type) {
      case 'postgresql':
        return this.generatePostgresBackup(config, persistence);
      case 'mysql':
      case 'mariadb':
        return this.generateMysqlBackup(config, persistence);
      case 'mongodb':
        return this.generateMongoBackup(config, persistence);
      default:
        return '';
    }
  }

  private static generatePostgresBackup(config: DatabaseConfig, persistence: PersistenceConfig): string {
    const db = config.database || 'postgres';
    const backupDir = `${persistence.mountPath}/backups`;

    return `#!/bin/bash
BACKUP_DIR="${backupDir}"
mkdir -p "$BACKUP_DIR"

pg_dump -U ${config.username || 'postgres'} -d ${db} | gzip > "$BACKUP_DIR/backup-$(date +%Y%m%d_%H%M%S).sql.gz"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +7 -delete
`;
  }

  private static generateMysqlBackup(config: DatabaseConfig, persistence: PersistenceConfig): string {
    const db = config.database || 'mysql';
    const backupDir = `${persistence.mountPath}/backups`;

    return `#!/bin/bash
BACKUP_DIR="${backupDir}"
mkdir -p "$BACKUP_DIR"

mysqldump -u${config.username || 'root'} -p"$MYSQL_ROOT_PASSWORD" ${db} | gzip > "$BACKUP_DIR/backup-$(date +%Y%m%d_%H%M%S).sql.gz"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +7 -delete
`;
  }

  private static generateMongoBackup(config: DatabaseConfig, persistence: PersistenceConfig): string {
    const db = config.database || 'test';
    const backupDir = `${persistence.mountPath}/backups`;

    return `#!/bin/bash
BACKUP_DIR="${backupDir}"
mkdir -p "$BACKUP_DIR"

mongodump --uri="mongodb://localhost:27017/${db}" --archive="$BACKUP_DIR/backup-$(date +%Y%m%d_%H%M%S).archive"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup-*.archive" -mtime +7 -delete
`;
  }
}

// ==================== HEALTH CHECK GENERATOR (Error #30) ====================

export class HealthCheckGenerator {
  /**
   * Error #30: Generate database-specific health checks
   */
  static generateHealthCheck(config: DatabaseConfig): HealthCheckConfig {
    return {
      command: this.generateHealthCommand(config),
      interval: 30,
      timeout: 10,
      retries: 3,
      startPeriod: 40
    };
  }

  private static generateHealthCommand(config: DatabaseConfig): string {
    switch (config.type) {
      case 'postgresql':
        return `pg_isready -U ${config.username || 'postgres'} -h localhost -p ${config.port || 5432}`;

      case 'mysql':
      case 'mariadb':
        return `mysqladmin ping -u${config.username || 'root'} -p"$MYSQL_ROOT_PASSWORD" -h localhost`;

      case 'mongodb':
        return `mongo --eval "db.adminCommand('ping')" --quiet`;

      case 'redis':
        return `redis-cli -h localhost -p ${config.port || 6379} ping`;

      case 'sqlite':
        return `test -f ${config.database || '/app/data.db'}`;

      case 'oracle':
        return `sqlplus -s ${config.username}/${config.password}@localhost:${config.port}/${config.database} <<< "SELECT 1 FROM DUAL;" > /dev/null`;

      case 'mssql':
        return `/opt/mssql-tools/bin/sqlcmd -S localhost -U ${config.username || 'sa'} -P "$SA_PASSWORD" -Q "SELECT 1" > /dev/null 2>&1`;

      default:
        return 'true';
    }
  }

  /**
   * Generate docker-compose health check configuration
   */
  static generateDockerHealthCheck(healthCheck: HealthCheckConfig): string {
    return `healthcheck:
  test: ["CMD-SHELL", "${healthCheck.command}"]
  interval: ${healthCheck.interval}s
  timeout: ${healthCheck.timeout}s
  retries: ${healthCheck.retries}
  start_period: ${healthCheck.startPeriod}s`;
  }
}

export default {
  DatabaseDetector,
  ConnectionStringGenerator,
  DatabaseInitializer,
  DataPersistenceManager,
  HealthCheckGenerator
};
