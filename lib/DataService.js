// services/DataService.js
class DataService {
  constructor(db) {
    this.db = db;
  }

  async query(sql, params = []) {
    try {
      const [rows] = await this.db.execute(sql, params);
      return rows;
    } catch (error) {
      throw new Error(`Database query error: ${error.message}`);
    }
  }

  async findById(table, id) {
    return this.query(
      `SELECT * FROM ${table} WHERE ${table}ID = ?`,
      [id]
    );
  }

  async findAll(table, { page, limit, filter } = {}) {
    let sql = `SELECT * FROM ${table}`;
    const params = [];

    if (filter) {
      sql += ` WHERE ${filter}`;
    }

    if (page !== undefined && limit !== undefined) {
      const offset = page * limit;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    return this.query(sql, params);
  }

  async create(table, data) {
    const fields = Object.keys(data).filter(key => key !== `${table}ID`);
    const values = fields.map(field => data[field]);
    const sql = `
      INSERT INTO ${table} (${fields.join(', ')}) 
      VALUES (${fields.map(() => '?').join(', ')})
    `;

    const result = await this.query(sql, values);
    return result.insertId;
  }

  async update(table, id, data) {
    const fields = Object.keys(data).filter(key => key !== `${table}ID`);
    const values = fields.map(field => data[field]);
    const sql = `
      UPDATE ${table} 
      SET ${fields.map(field => `${field} = ?`).join(', ')} 
      WHERE ${table}ID = ?
    `;

    return this.query(sql, [...values, id]);
  }

  async delete(table, id) {
    return this.query(
      `DELETE FROM ${table} WHERE ${table}ID = ?`,
      [id]
    );
  }

  async createClamp(local, localId, remote, remoteId, context = null) {
    const sql = `
      INSERT INTO Clamp (local, local_id, remote, remote_id, context) 
      VALUES (?, ?, ?, ?, ?)
    `;
    return this.query(sql, [local, localId, remote, remoteId, context]);
  }

  async removeClamp(local, localId, remote, remoteId) {
    const sql = `
      DELETE FROM Clamp 
      WHERE local = ? AND local_id = ? AND remote = ? AND remote_id = ?
    `;
    return this.query(sql, [local, localId, remote, remoteId]);
  }

  async getRelated(table, id, relatedTable) {
    const sql = `
      SELECT r.* 
      FROM ${relatedTable} r
      JOIN Clamp c ON c.remote_id = r.${relatedTable}ID
      WHERE c.local = ? AND c.local_id = ? AND c.remote = ?
    `;
    return this.query(sql, [table, id, relatedTable]);
  }

  async search(table, criteria) {
    const conditions = [];
    const values = [];

    Object.entries(criteria).forEach(([field, value]) => {
      if (value.includes('%')) {
        conditions.push(`${field} LIKE ?`);
      } else {
        conditions.push(`${field} = ?`);
      }
      values.push(value);
    });

    const sql = `
      SELECT * FROM ${table} 
      WHERE ${conditions.join(' AND ')}
    `;

    return this.query(sql, values);
  }

  async getTables() {
    return this.query('SHOW TABLES');
  }

  async initializeSchema(schema) {
    const statements = schema.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      await this.query(statement);
    }
  }
}

module.exports = DataService;
