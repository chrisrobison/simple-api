// utils/ClassLoader.js
const fs = require('fs').promises;
const path = require('path');
const Boss = require('../lib/Boss');

class ClassLoader {
  constructor(dataService) {
    this.dataService = dataService;
    this.customClasses = new Map();
  }

  async loadCustomClasses() {
    try {
      const customClassesDir = path.join(__dirname, '../ext');
      
      // Ensure the directory exists
      try {
        await fs.access(customClassesDir);
      } catch {
        console.log('No custom controllers directory found');
        return;
      }

      // Read all files in the custom controllers directory
      const files = await fs.readdir(customClassesDir);
      
      // Load each custom class
      for (const file of files) {
        if (file.endsWith('.js')) {
          const className = path.basename(file, '.js');
          const CustomClass = require(path.join(customClassesDir, file));
          
          // Verify the class extends Boss
          if (CustomClass.prototype instanceof Boss) {
            this.customClasses.set(className, CustomClass);
            console.log(`Loaded custom controller: ${className}`);
          } else {
            console.warn(`Warning: ${className} does not extend Boss`);
          }
        }
      }
    } catch (error) {
      console.error('Error loading custom classes:', error);
    }
  }

  getController(tableName) {
    const CustomClass = this.customClasses.get(tableName);
    if (CustomClass) {
      return new CustomClass(tableName, this.dataService);
    }
    return new Boss(tableName, this.dataService);
  }

  getCustomMethods(tableName) {
    const CustomClass = this.customClasses.get(tableName);
    if (!CustomClass) return [];

    // Get all methods of the custom class
    const methods = Object.getOwnPropertyNames(CustomClass.prototype);
    
    // Filter out base controller methods and constructor
    const baseMethods = Object.getOwnPropertyNames(Boss.prototype);
    return methods.filter(method => 
      !baseMethods.includes(method) && 
      method !== 'constructor'
    );
  }
}

module.exports = ClassLoader;
