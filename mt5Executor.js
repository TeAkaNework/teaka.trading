import { PythonShell } from 'python-shell';
import { logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MT5Executor {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.scriptPath = path.join(__dirname, '..', 'python', 'mt5_executor.py');
  }

  async executeSignal(signal) {
    try {
      logger.info('Executing MT5 signal', { signal });

      const options = {
        mode: 'json',
        pythonPath: this.pythonPath,
        pythonOptions: ['-u'], // unbuffered output
        scriptPath: path.dirname(this.scriptPath),
        args: [],
      };

      const executionData = {
        symbol: signal.symbol,
        volume: signal.volume || 0.1,
        action: signal.type,
        tp: signal.takeProfit.toNumber(),
        sl: signal.stopLoss.toNumber(),
      };

      const pyshell = new PythonShell('mt5_executor.py', options);

      return new Promise((resolve, reject) => {
        // Send signal data to Python script
        pyshell.send(JSON.stringify(executionData));

        pyshell.on('message', (message) => {
          logger.info('MT5 execution result:', message);
          resolve(message);
        });

        pyshell.on('error', (error) => {
          logger.error('MT5 execution error:', error);
          reject(error);
        });

        pyshell.end((err, code, signal) => {
          if (err) {
            logger.error('MT5 script error:', err);
            reject(err);
          }
        });
      });
    } catch (error) {
      logger.error('MT5 execution failed:', error);
      throw error;
    }
  }

  async checkConnection() {
    try {
      const options = {
        mode: 'json',
        pythonPath: this.pythonPath,
        pythonOptions: ['-u'],
        scriptPath: path.dirname(this.scriptPath),
        args: ['--check-connection'],
      };

      const result = await new Promise((resolve, reject) => {
        PythonShell.run('mt5_executor.py', options, (err, output) => {
          if (err) reject(err);
          resolve(output);
        });
      });

      return result[0]?.connected || false;
    } catch (error) {
      logger.error('MT5 connection check failed:', error);
      return false;
    }
  }
}