// controllers/Boss.js

class Boss {
  constructor(tableName, dataService) {
    this.tableName = tableName;
    this.dataService = dataService;
  }

  /**
   * Get records with optional pagination
   * @param {number} id - Optional record ID
   * @param {number} page - Page number (0-based)
   * @param {number} limit - Records per page
   */
  async get(id = null, page = 0, limit = 100) {
    try {
      if (id) {
        const rows = await this.dataService.findById(this.tableName, id);
        if (rows.length === 0) {
          return { status: 'error', message: 'Record not found' };
        }
        const record = rows[0];
        
        // Get related records
        const related = await this.getRelatedRecords(id);
        Object.assign(record, related);
        
        return { status: 'ok', data: { [this.tableName]: record } };
      }
      
      const totalRecords = await this.dataService.query(
        `SELECT COUNT(*) as count FROM ${this.tableName}`
      );
      
      const rows = await this.dataService.findAll(this.tableName, { 
        page, 
        limit 
      });
      
      // Get related records for each row
      for (const row of rows) {
        const related = await this.getRelatedRecords(row[`${this.tableName}ID`]);
        Object.assign(row, related);
      }
      
      return { 
        status: 'ok',
        page,
        count: limit,
        totalRecords: totalRecords[0].count,
        data: { [this.tableName]: rows }
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Create new record
   * @param {Object} data - Record data
   */
  async create(data) {
    try {
      // Optional hook for pre-create operations
      if (typeof this.beforeCreate === 'function') {
        data = await this.beforeCreate(data);
      }

      const newId = await this.dataService.create(this.tableName, data);
      
      // Handle relationships if any exist
      await this.handleRelationships(newId, data);
      
      // Optional hook for post-create operations
      if (typeof this.afterCreate === 'function') {
        await this.afterCreate(newId, data);
      }

      const result = await this.get(newId);
      return result;
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Update existing record
   * @param {number} id - Record ID
   * @param {Object} data - Updated data
   */
  async update(id, data) {
    try {
      // Check if record exists
      const existing = await this.dataService.findById(this.tableName, id);
      if (existing.length === 0) {
        return { status: 'error', message: 'Record not found' };
      }

      // Optional hook for pre-update operations
      if (typeof this.beforeUpdate === 'function') {
        data = await this.beforeUpdate(id, data);
      }

      await this.dataService.update(this.tableName, id, data);
      
      // Handle relationships if any exist
      await this.handleRelationships(id, data);
      
      // Optional hook for post-update operations
      if (typeof this.afterUpdate === 'function') {
        await this.afterUpdate(id, data);
      }

      const result = await this.get(id);
      return result;
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Delete record
   * @param {number} id - Record ID
   */
  async delete(id) {
    try {
      // Check if record exists
      const existing = await this.dataService.findById(this.tableName, id);
      if (existing.length === 0) {
        return { status: 'error', message: 'Record not found' };
      }

      // Optional hook for pre-delete operations
      if (typeof this.beforeDelete === 'function') {
        await this.beforeDelete(id);
      }

      // Remove all relationships first
      await this.dataService.query(
        'DELETE FROM Clamp WHERE (local = ? AND local_id = ?) OR (remote = ? AND remote_id = ?)',
        [this.tableName, id, this.tableName, id]
      );

      await this.dataService.delete(this.tableName, id);
      
      // Optional hook for post-delete operations
      if (typeof this.afterDelete === 'function') {
        await this.afterDelete(id);
      }

      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Handle relationships for a record
   * @param {number} localId - Record ID
   * @param {Object} data - Record data containing relationships
   */
  async handleRelationships(localId, data) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        if (value.id === 'new') {
          // Create new related record
          const controller = new Boss(key, this.dataService);
          const result = await controller.create(value);
          if (result.status === 'ok') {
            await this.clamp(localId, key, result.data[key][`${key}ID`]);
          }
        } else if (value.id) {
          // Clamp existing record
          await this.clamp(localId, key, value.id);
        }
      }
    }
  }

  /**
   * Create relationship between records
   * @param {number} localId - Local record ID
   * @param {string} remoteTable - Remote table name
   * @param {number} remoteId - Remote record ID
   */
  async clamp(localId, remoteTable, remoteId, context = null) {
    try {
      await this.dataService.createClamp(
        this.tableName,
        localId,
        remoteTable,
        remoteId,
        context
      );
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Get all related records for a given record
   * @param {number} id - Record ID
   */
  async getRelatedRecords(id) {
    try {
      // Get all relationships for this record
      const relationships = await this.dataService.query(
        'SELECT remote, remote_id FROM Clamp WHERE local = ? AND local_id = ?',
        [this.tableName, id]
      );

      const related = {};
      
      // Group relationships by remote table
      for (const rel of relationships) {
        const remoteRecords = await this.dataService.findById(
          rel.remote,
          rel.remote_id
        );
        
        if (remoteRecords.length > 0) {
          if (!related[rel.remote]) {
            related[rel.remote] = remoteRecords[0];
          }
        }
      }

      return related;
    } catch (error) {
      console.error('Error getting related records:', error);
      return {};
    }
  }

  /**
   * Search records based on criteria
   * @param {Object} criteria - Search criteria
   */
  async search(criteria) {
    try {
      const results = await this.dataService.search(this.tableName, criteria);
      
      // Get related records for each result
      for (const row of results) {
        const related = await this.getRelatedRecords(row[`${this.tableName}ID`]);
        Object.assign(row, related);
      }
      
      return { status: 'ok', data: { [this.tableName]: results } };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

module.exports = Boss;
