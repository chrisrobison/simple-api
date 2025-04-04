// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DataService = require('./services/DataService');
const ClassLoader = require('./utils/ClassLoader');
const app = express();
app.use(express.json());

// SSL configuration
const sslConfig = {
  cert: fs.readFileSync('/etc/letsencrypt/live/11oclocktoast.com/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/11oclocktoast.com/privkey.pem')
};

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'simple_api',
  port: parseInt(process.env.DB_PORT || '3306'),
};

// Base controller for handling generic table operations
class Boss {
  constructor(tableName, dataService) {
    this.tableName = tableName;
    this.dataService = dataService;
  }

  async get(id = null, page = 0, limit = 100) {
    try {
      if (id) {
        const rows = await this.dataService.findById(this.tableName, id);
        return { status: 'ok', data: { [this.tableName]: rows[0] } };
      }
      
      const rows = await this.dataService.findAll(this.tableName, { page, limit });
      return { status: 'ok', data: { [this.tableName]: rows } };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async create(data) {
    try {
      const newId = await this.dataService.create(this.tableName, data);
      await this.handleRelationships(newId, data);
      const result = await this.dataService.findById(this.tableName, newId);
      return { status: 'ok', data: { [this.tableName]: result[0] } };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async update(id, data) {
    try {
      await this.dataService.update(this.tableName, id, data);
      await this.handleRelationships(id, data);
      const result = await this.dataService.findById(this.tableName, id);
      return { status: 'ok', data: { [this.tableName]: result[0] } };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async delete(id) {
    try {
      await this.dataService.delete(this.tableName, id);
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async handleRelationships(localId, data) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        if (value.id === 'new') {
          // Create new related record
          const controller = new Boss(key, this.dataService);
          const result = await controller.create(value);
          await this.clamp(localId, key, result.data[key][`${key}ID`]);
        } else if (value.id) {
          // Clamp existing record
          await this.clamp(localId, key, value.id);
        }
      }
    }
  }

  async clamp(localId, remoteTable, remoteId) {
    try {
      await this.dataService.createClamp(this.tableName, localId, remoteTable, remoteId);
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async search(criteria) {
    try {
      const results = await this.dataService.search(this.tableName, criteria);
      return { status: 'ok', data: { [this.tableName]: results } };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

// Route handler setup
async function setupRoutes(app, dataService, classLoader) {
  const tables = await dataService.getTables();
  
  tables.forEach(tableRow => {
    const tableName = tableRow[`Tables_in_${dbConfig.database}`];
    if (tableName !== 'Clamp') {
      const controller = classLoader.getController(tableName);
      
      // Get any custom methods for this controller
      const customMethods = classLoader.getCustomMethods(tableName);
      
      app.get(`/api/${tableName}`, async (req, res) => {
        const { pg, cnt } = req.query;
        const result = await controller.get(null, parseInt(pg), parseInt(cnt));
        res.json(result);
      });
      
      app.get(`/api/${tableName}/:id`, async (req, res) => {
        const result = await controller.get(req.params.id);
        res.json(result);
      });
      
      app.put(`/api/${tableName}`, async (req, res) => {
        const result = await controller.create(req.body[tableName][0]);
        res.json(result);
      });
      
      app.post(`/api/${tableName}/:id`, async (req, res) => {
        const result = await controller.update(req.params.id, req.body[tableName][0]);
        res.json(result);
      });
      
      app.delete(`/api/${tableName}/:id`, async (req, res) => {
        const result = await controller.delete(req.params.id);
        res.json(result);
      });
      
      app.get(`/api/${tableName}/clamp/:localId/:remoteTable/:remoteId`, async (req, res) => {
        const result = await controller.clamp(
          req.params.localId,
          req.params.remoteTable,
          req.params.remoteId
        );
        res.json(result);
      });

      app.post(`/api/search`, async (req, res) => {
        const criteria = req.body.search[tableName];
        if (criteria) {
          const result = await controller.search(criteria);
          res.json(result);
        }
      });

      // Set up routes for custom methods
      customMethods.forEach(method => {
        const requiresAuth = !['authenticate'].includes(method);
        const middleware = requiresAuth ? authMiddleware : optionalAuth;
        
        app.post(`/api/${tableName}/${method}`, middleware, async (req, res) => {
          try {
            const result = await controller[method](req.body, req);
            res.json(result);
          } catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
          }
        });
      });
    }
  });
}

// Database schema
const schema = `
CREATE TABLE IF NOT EXISTS Clamp (
  id INT PRIMARY KEY AUTO_INCREMENT,
  local VARCHAR(255) NOT NULL,
  local_id INT NOT NULL,
  remote VARCHAR(255) NOT NULL,
  remote_id INT NOT NULL,
  context VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS User (
  UserID INT PRIMARY KEY AUTO_INCREMENT,
  User VARCHAR(255) NOT NULL,
  Password VARCHAR(255) NOT NULL,
  Name VARCHAR(255),
  Phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS Employee (
  EmployeeID INT PRIMARY KEY AUTO_INCREMENT,
  Employee VARCHAR(255) NOT NULL,
  Address VARCHAR(255),
  City VARCHAR(255),
  State VARCHAR(2),
  Zip VARCHAR(10)
);
`;

// Start server
async function startServer() {
  try {
    const db = await mysql.createConnection(dbConfig);
    const dataService = new DataService(db);
    const classLoader = new ClassLoader(dataService);
    
    await dataService.initializeSchema(schema);
    await classLoader.loadCustomClasses();
    await setupRoutes(app, dataService, classLoader);
    
    const port = process.env.PORT || 4443;
    const server = https.createServer(sslConfig, app);
    
    server.listen(port, () => {
      console.log(`Simple API server running on https://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
