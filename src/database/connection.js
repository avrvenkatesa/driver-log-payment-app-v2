const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path - using the correct company.db in root directory
const DB_PATH = path.join(__dirname, '../../company.db');

/**
 * Database connection pool manager
 * Handles connection creation, pooling, and error handling
 */
class DatabaseConnection {
  constructor() {
    this.pool = [];
    this.maxConnections = 10;
    this.currentConnections = 0;
  }

  /**
   * Get a database connection from the pool or create a new one
   */
  async getConnection() {
    return new Promise((resolve, reject) => {
      // Check if database file exists
      if (!fs.existsSync(DB_PATH)) {
        const error = new Error(`Database file not found: ${DB_PATH}. Please run 'npm run db:init' first.`);
        console.error(`[${new Date().toISOString()}] ❌ Database connection error:`, error.message);
        reject(error);
        return;
      }

      // Try to get connection from pool
      if (this.pool.length > 0) {
        const connection = this.pool.pop();
        resolve(connection);
        return;
      }

      // Create new connection if under limit
      if (this.currentConnections < this.maxConnections) {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
          if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Database connection error:`, err.message);
            reject(err);
            return;
          }

          // Enable foreign key constraints
          db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
            if (pragmaErr) {
              console.error(`[${new Date().toISOString()}] ❌ Error enabling foreign keys:`, pragmaErr.message);
              reject(pragmaErr);
              return;
            }

            this.currentConnections++;
            console.log(`[${new Date().toISOString()}] ✅ Database connection established (${this.currentConnections}/${this.maxConnections})`);
            resolve(db);
          });
        });

        // Handle connection errors
        db.on('error', (err) => {
          console.error(`[${new Date().toISOString()}] ❌ Database connection error:`, err);
        });

      } else {
        // Wait for a connection to be returned to pool
        setTimeout(() => {
          this.getConnection().then(resolve).catch(reject);
        }, 100);
      }
    });
  }

  /**
   * Return a connection to the pool
   */
  releaseConnection(connection) {
    if (connection && this.pool.length < this.maxConnections) {
      this.pool.push(connection);
    } else if (connection) {
      // Close excess connections
      connection.close((err) => {
        if (err) {
          console.error(`[${new Date().toISOString()}] ❌ Error closing database connection:`, err.message);
        } else {
          this.currentConnections--;
        }
      });
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async query(sql, params = []) {
    return new Promise(async (resolve, reject) => {
      let connection;
      try {
        connection = await this.getConnection();
        
        connection.all(sql, params, (err, rows) => {
          if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Database query error:`, {
              error: err.message,
              sql: sql.substring(0, 100) + '...',
              params
            });
            reject(err);
          } else {
            resolve(rows);
          }
          
          // Return connection to pool
          this.releaseConnection(connection);
        });
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Database connection error:`, error.message);
        if (connection) {
          this.releaseConnection(connection);
        }
        reject(error);
      }
    });
  }

  /**
   * Execute a single row query
   */
  async get(sql, params = []) {
    return new Promise(async (resolve, reject) => {
      let connection;
      try {
        connection = await this.getConnection();
        
        connection.get(sql, params, (err, row) => {
          if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Database get error:`, {
              error: err.message,
              sql: sql.substring(0, 100) + '...',
              params
            });
            reject(err);
          } else {
            resolve(row);
          }
          
          // Return connection to pool
          this.releaseConnection(connection);
        });
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Database connection error:`, error.message);
        if (connection) {
          this.releaseConnection(connection);
        }
        reject(error);
      }
    });
  }

  /**
   * Execute an insert/update/delete query
   */
  async run(sql, params = []) {
    return new Promise(async (resolve, reject) => {
      let connection;
      try {
        connection = await this.getConnection();
        const self = this;
        
        connection.run(sql, params, function(err) {
          if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Database run error:`, {
              error: err.message,
              sql: sql.substring(0, 100) + '...',
              params
            });
            reject(err);
          } else {
            resolve({
              lastID: this.lastID,
              changes: this.changes
            });
          }
          
          // Return connection to pool
          self.releaseConnection(connection);
        });
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Database connection error:`, error.message);
        if (connection) {
          this.releaseConnection(connection);
        }
        reject(error);
      }
    });
  }

  /**
   * Execute a transaction
   */
  async transaction(operations) {
    return new Promise(async (resolve, reject) => {
      let connection;
      try {
        connection = await this.getConnection();
        
        connection.serialize(() => {
          connection.run('BEGIN TRANSACTION;', (err) => {
            if (err) {
              reject(err);
              return;
            }

            let completed = 0;
            const results = [];

            operations.forEach((operation, index) => {
              const { sql, params } = operation;
              
              connection.run(sql, params, function(err) {
                if (err) {
                  connection.run('ROLLBACK;', () => {
                    reject(err);
                  });
                  return;
                }

                results[index] = {
                  lastID: this.lastID,
                  changes: this.changes
                };

                completed++;
                
                if (completed === operations.length) {
                  connection.run('COMMIT;', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      resolve(results);
                    }
                  });
                }
              });
            });
          });
        });

      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Database transaction error:`, error.message);
        reject(error);
      } finally {
        if (connection) {
          this.releaseConnection(connection);
        }
      }
    });
  }

  /**
   * Close all connections
   */
  async closeAll() {
    const closePromises = this.pool.map(connection => {
      return new Promise((resolve) => {
        connection.close((err) => {
          if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Error closing connection:`, err.message);
          }
          resolve();
        });
      });
    });

    await Promise.all(closePromises);
    this.pool = [];
    this.currentConnections = 0;
    console.log(`[${new Date().toISOString()}] ✅ All database connections closed`);
  }

  /**
   * Health check - verify database is accessible
   */
  async healthCheck() {
    try {
      const result = await this.get("SELECT 1 as health_check");
      return {
        status: 'healthy',
        database: true,
        connections: {
          active: this.currentConnections,
          pooled: this.pool.length,
          max: this.maxConnections
        },
        file: DB_PATH,
        accessible: result && result.health_check === 1
      };
    } catch (error) {
      return {
        status: 'error',
        database: false,
        error: error.message,
        file: DB_PATH,
        accessible: false
      };
    }
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(`[${new Date().toISOString()}] 🛑 Closing database connections...`);
  await dbConnection.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`[${new Date().toISOString()}] 🛑 Closing database connections...`);
  await dbConnection.closeAll();
  process.exit(0);
});

module.exports = dbConnection;