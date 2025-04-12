import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { MT5Executor } from './mt5Executor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SignalHandler {
  constructor() {
    this.mt5Executor = new MT5Executor();
    this.signalPath = path.join(__dirname, '..', 'signals');
  }

  async initialize() {
    try {
      // Ensure signals directory exists
      await fs.mkdir(this.signalPath, { recursive: true });
      logger.info('Signal handler initialized');
      
      // Start watching for signal files
      this.watchSignals();
    } catch (error) {
      logger.error('Failed to initialize signal handler:', error);
      throw error;
    }
  }

  async watchSignals() {
    try {
      // Check for signal files every second
      setInterval(async () => {
        const files = await fs.readdir(this.signalPath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            await this.processSignalFile(file);
          }
        }
      }, 1000);
      
      logger.info('Signal watcher started');
    } catch (error) {
      logger.error('Signal watcher error:', error);
    }
  }

  async processSignalFile(filename) {
    const filePath = path.join(this.signalPath, filename);
    
    try {
      // Read signal file
      const content = await fs.readFile(filePath, 'utf8');
      const signal = JSON.parse(content);
      
      logger.info('Processing signal:', { signal });

      // Validate signal
      if (!this.validateSignal(signal)) {
        throw new Error('Invalid signal format');
      }

      // Execute trade
      const result = await this.mt5Executor.executeSignal(signal);
      
      logger.info('Trade execution result:', result);

      // Archive processed signal
      const archivePath = path.join(this.signalPath, 'archive');
      await fs.mkdir(archivePath, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFile = path.join(
        archivePath,
        `${path.parse(filename).name}_${timestamp}.json`
      );
      
      await fs.writeFile(archiveFile, JSON.stringify({
        signal,
        result,
        processed_at: new Date().toISOString()
      }, null, 2));

      // Delete original signal file
      await fs.unlink(filePath);
      
      logger.info('Signal processed successfully');

    } catch (error) {
      logger.error('Error processing signal file:', error);
      
      // Move failed signal to errors folder
      const errorPath = path.join(this.signalPath, 'errors');
      await fs.mkdir(errorPath, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const errorFile = path.join(
        errorPath,
        `${path.parse(filename).name}_${timestamp}_error.json`
      );
      
      await fs.writeFile(errorFile, JSON.stringify({
        signal: await fs.readFile(filePath, 'utf8'),
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }, null, 2));

      await fs.unlink(filePath);
    }
  }

  validateSignal(signal) {
    const requiredFields = ['symbol', 'volume', 'action', 'tp', 'sl'];
    
    for (const field of requiredFields) {
      if (!(field in signal)) {
        logger.error(`Missing required field: ${field}`);
        return false;
      }
    }

    if (!['BUY', 'SELL'].includes(signal.action)) {
      logger.error('Invalid action type');
      return false;
    }

    if (typeof signal.volume !== 'number' || signal.volume <= 0) {
      logger.error('Invalid volume');
      return false;
    }

    if (typeof signal.tp !== 'number' || typeof signal.sl !== 'number') {
      logger.error('Invalid TP/SL values');
      return false;
    }

    return true;
  }
}