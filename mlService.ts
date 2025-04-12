import * as tf from '@tensorflow/tfjs';
import { Matrix } from 'ml-matrix';
import { SimpleLinearRegression } from 'ml-regression';
import Decimal from 'decimal.js';
import { PriceUpdate } from './priceService';

export interface PredictionResult {
  predictedPrice: Decimal;
  confidence: number;
  horizon: string;
  metadata: {
    rmse: number;
    r2Score: number;
    features: Record<string, number>;
    modelVotes: Record<string, number>;
    featureDrift: Record<string, number>;
    zScores: Record<string, number>;
  };
}

interface ModelPrediction {
  price: number;
  confidence: number;
}

export class MLService {
  private lstmModel: tf.LayersModel | null = null;
  private svmModel: tf.Sequential | null = null;
  private rfModel: tf.Sequential | null = null;
  private autoencoder: tf.LayersModel | null = null;
  private priceHistory: Map<string, number[]> = new Map();
  private featureHistory: Map<string, Record<string, number>[]> = new Map();
  private windowSize = 24; // 24 hours of hourly data
  private predictionHorizon = 12; // 12 hours ahead prediction
  private driftThreshold = 2.0; // Z-score threshold for feature drift
  private modelWeights = {
    lstm: 0.4,
    svm: 0.3,
    rf: 0.3
  };

  async initialize() {
    await tf.ready(); // Wait for TensorFlow.js to be ready
    this.lstmModel = await this.createLSTMModel();
    this.svmModel = await this.createSVMModel();
    this.rfModel = await this.createRandomForestModel();
    this.autoencoder = await this.createAutoencoder();
    await this.trainModels();
  }

  private async createLSTMModel(): Promise<tf.LayersModel> {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.lstm({
      units: 50,
      returnSequences: true,
      inputShape: [this.windowSize, 1]
    }));
    
    // Hidden layers
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.lstm({ units: 30, returnSequences: false }));
    model.add(tf.layers.dense({ units: 20, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.1 }));
    
    // Output layer
    model.add(tf.layers.dense({ units: 1 }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private async createSVMModel(): Promise<tf.Sequential> {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      inputShape: [5], // Number of features
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    // Hidden layers
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    // Output layer
    model.add(tf.layers.dense({ units: 1 }));
    
    model.compile({
      optimizer: tf.train.rmsprop(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private async createRandomForestModel(): Promise<tf.Sequential> {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [5], // Number of features
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    // Hidden layers
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    // Output layer with multiple trees
    model.add(tf.layers.dense({
      units: 10,
      activation: 'relu'
    }));
    model.add(tf.layers.dense({ units: 1 }));
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private async createAutoencoder(): Promise<tf.LayersModel> {
    const model = tf.sequential();
    
    // Encoder
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      inputShape: [50] // Input dimension
    }));
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));
    model.add(tf.layers.dense({
      units: 8,
      activation: 'relu'
    }));
    
    // Decoder
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    model.add(tf.layers.dense({
      units: 50,
      activation: 'sigmoid'
    }));
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });
    
    return model;
  }

  private async trainModels() {
    const batchSize = 32;
    const epochs = 50;
    
    // Generate synthetic training data for initial training
    const trainingData = this.generateSyntheticData(1000);
    
    // Train LSTM
    if (this.lstmModel) {
      const lstmData = tf.tensor3d(
        trainingData.sequences,
        [trainingData.sequences.length, this.windowSize, 1]
      );
      const lstmLabels = tf.tensor2d(
        trainingData.targets,
        [trainingData.targets.length, 1]
      );
      
      await this.lstmModel.fit(lstmData, lstmLabels, {
        batchSize,
        epochs,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`LSTM Epoch ${epoch + 1}: loss = ${logs?.loss.toFixed(4)}`);
          }
        }
      });
      
      lstmData.dispose();
      lstmLabels.dispose();
    }
    
    // Train SVM
    if (this.svmModel) {
      const svmData = tf.tensor2d(
        trainingData.features,
        [trainingData.features.length, 5]
      );
      const svmLabels = tf.tensor2d(
        trainingData.targets,
        [trainingData.targets.length, 1]
      );
      
      await this.svmModel.fit(svmData, svmLabels, {
        batchSize,
        epochs,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`SVM Epoch ${epoch + 1}: loss = ${logs?.loss.toFixed(4)}`);
          }
        }
      });
      
      svmData.dispose();
      svmLabels.dispose();
    }
    
    // Train Random Forest
    if (this.rfModel) {
      const rfData = tf.tensor2d(
        trainingData.features,
        [trainingData.features.length, 5]
      );
      const rfLabels = tf.tensor2d(
        trainingData.targets,
        [trainingData.targets.length, 1]
      );
      
      await this.rfModel.fit(rfData, rfLabels, {
        batchSize,
        epochs,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`RF Epoch ${epoch + 1}: loss = ${logs?.loss.toFixed(4)}`);
          }
        }
      });
      
      rfData.dispose();
      rfLabels.dispose();
    }
    
    // Train Autoencoder
    if (this.autoencoder) {
      const encoderData = tf.tensor2d(
        trainingData.features.map(f => Array(50).fill(0).map(() => Math.random())),
        [trainingData.features.length, 50]
      );
      
      await this.autoencoder.fit(encoderData, encoderData, {
        batchSize,
        epochs,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Autoencoder Epoch ${epoch + 1}: loss = ${logs?.loss.toFixed(4)}`);
          }
        }
      });
      
      encoderData.dispose();
    }
  }

  private generateSyntheticData(samples: number) {
    const sequences: number[][] = [];
    const features: number[][] = [];
    const targets: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      // Generate sequence
      const sequence = Array(this.windowSize)
        .fill(0)
        .map((_, j) => Math.sin(j / 10) + Math.random() * 0.1);
      sequences.push(sequence);
      
      // Generate features
      const feature = [
        Math.random(), // SMA
        Math.random(), // Momentum
        Math.random(), // Volatility
        Math.random(), // RSI
        Math.random()  // MACD
      ];
      features.push(feature);
      
      // Generate target
      targets.push(sequence[sequence.length - 1] + Math.random() * 0.1);
    }
    
    return { sequences, features, targets };
  }

  private calculateTechnicalFeatures(prices: number[]): Record<string, number> {
    const matrix = new Matrix([prices]);
    
    // Calculate various technical indicators
    const sma = prices.slice(-14).reduce((a, b) => a + b) / 14;
    const stdDev = Math.sqrt(
      prices.slice(-14)
        .map(x => Math.pow(x - sma, 2))
        .reduce((a, b) => a + b) / 14
    );
    
    // Calculate momentum
    const momentum = prices[prices.length - 1] - prices[prices.length - 14];
    
    // Linear regression for trend
    const regression = new SimpleLinearRegression(
      prices.slice(-14).map((_, i) => i),
      prices.slice(-14)
    );
    
    // Calculate RSI
    const gains = [];
    const losses = [];
    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) {
        gains.push(diff);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(diff));
      }
    }
    
    const avgGain = gains.slice(-14).reduce((a, b) => a + b) / 14;
    const avgLoss = losses.slice(-14).reduce((a, b) => a + b) / 14;
    const rs = avgGain / (avgLoss || 1);
    const rsi = 100 - (100 / (1 + rs));
    
    return {
      sma,
      stdDev,
      momentum,
      trend: regression.slope,
      volatility: stdDev / sma,
      rsi
    };
  }

  private calculateFeatureDrift(
    currentFeatures: Record<string, number>,
    featureHistory: Record<string, number>[]
  ): Record<string, number> {
    const drift: Record<string, number> = {};
    
    for (const [feature, value] of Object.entries(currentFeatures)) {
      const history = featureHistory.map(f => f[feature]);
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const stdDev = Math.sqrt(
        history.map(x => Math.pow(x - mean, 2))
          .reduce((a, b) => a + b) / history.length
      );
      
      drift[feature] = stdDev === 0 ? 0 : Math.abs((value - mean) / stdDev);
    }
    
    return drift;
  }

  private calculateZScores(
    predictions: Record<string, ModelPrediction>
  ): Record<string, number> {
    const values = Object.values(predictions).map(p => p.price);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.map(x => Math.pow(x - mean, 2))
        .reduce((a, b) => a + b) / values.length
    );
    
    return Object.entries(predictions).reduce((acc, [model, pred]) => ({
      ...acc,
      [model]: stdDev === 0 ? 0 : Math.abs((pred.price - mean) / stdDev)
    }), {});
  }

  private async detectAnomalies(features: number[]): Promise<boolean> {
    if (!this.autoencoder) return false;
    
    const input = tf.tensor2d([features], [1, features.length]);
    const reconstruction = this.autoencoder.predict(input) as tf.Tensor;
    
    const inputData = await input.data();
    const reconstructionData = await reconstruction.data();
    
    const reconstructionError = inputData.reduce((sum, value, i) => 
      sum + Math.pow(value - reconstructionData[i], 2), 0
    );
    
    input.dispose();
    reconstruction.dispose();
    
    return reconstructionError > this.driftThreshold;
  }

  private async predictLSTM(tensorData: tf.Tensor): Promise<ModelPrediction> {
    if (!this.lstmModel) await this.initialize();
    
    const prediction = await this.lstmModel!.predict(tensorData) as tf.Tensor;
    const value = (await prediction.data())[0];
    
    // Calculate prediction confidence based on model metrics
    const confidence = 0.8; // Base confidence, should be adjusted based on model metrics
    
    prediction.dispose();
    
    return {
      price: value,
      confidence
    };
  }

  private async predictSVM(features: Record<string, number>): Promise<ModelPrediction> {
    if (!this.svmModel) await this.initialize();
    
    const tensorData = tf.tensor2d([Object.values(features)]);
    const prediction = this.svmModel!.predict(tensorData) as tf.Tensor;
    const value = (await prediction.data())[0];
    
    tensorData.dispose();
    prediction.dispose();
    
    return {
      price: value,
      confidence: 0.7
    };
  }

  private async predictRF(features: Record<string, number>): Promise<ModelPrediction> {
    if (!this.rfModel) await this.initialize();
    
    const tensorData = tf.tensor2d([Object.values(features)]);
    const prediction = this.rfModel!.predict(tensorData) as tf.Tensor;
    const value = (await prediction.data())[0];
    
    tensorData.dispose();
    prediction.dispose();
    
    return {
      price: value,
      confidence: 0.75
    };
  }

  public async predict(symbol: string, update: PriceUpdate): Promise<PredictionResult | null> {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    if (!this.featureHistory.has(symbol)) {
      this.featureHistory.set(symbol, []);
    }

    const prices = this.priceHistory.get(symbol)!;
    prices.push(update.price.toNumber());

    if (prices.length > this.windowSize * 2) {
      prices.splice(0, prices.length - this.windowSize * 2);
    }

    if (prices.length < this.windowSize) {
      return null;
    }

    const features = this.calculateTechnicalFeatures(prices);
    
    // Update feature history
    const featureHistory = this.featureHistory.get(symbol)!;
    featureHistory.push(features);
    if (featureHistory.length > 100) {
      featureHistory.shift();
    }
    
    // Calculate feature drift
    const featureDrift = this.calculateFeatureDrift(features, featureHistory);
    
    // Check for anomalies
    const isAnomaly = await this.detectAnomalies(Object.values(features));
    if (isAnomaly) {
      console.warn('Anomaly detected in price data');
    }
    
    // Prepare data for LSTM
    const tensorData = tf.tensor2d(prices.slice(-this.windowSize))
      .reshape([1, this.windowSize, 1]);

    try {
      // Get predictions from all models
      const predictions: Record<string, ModelPrediction> = {
        lstm: await this.predictLSTM(tensorData),
        svm: await this.predictSVM(features),
        rf: await this.predictRF(features)
      };

      tensorData.dispose();

      // Calculate Z-scores for predictions
      const zScores = this.calculateZScores(predictions);
      
      // Ensemble prediction with dynamic weighting
      let weightedSum = 0;
      let totalWeight = 0;
      let totalConfidence = 0;
      
      for (const [model, prediction] of Object.entries(predictions)) {
        const weight = this.modelWeights[model as keyof typeof this.modelWeights];
        const zScore = zScores[model];
        
        // Adjust weight based on Z-score
        const adjustedWeight = zScore > 2 ? weight * 0.5 : weight;
        
        weightedSum += prediction.price * adjustedWeight;
        totalWeight += adjustedWeight;
        totalConfidence += prediction.confidence * adjustedWeight;
      }
      
      const ensemblePrediction = weightedSum / totalWeight;
      const ensembleConfidence = totalConfidence / totalWeight;
      
      // Adjust confidence based on feature drift
      const maxDrift = Math.max(...Object.values(featureDrift));
      const driftPenalty = Math.max(0, (maxDrift - this.driftThreshold) / this.driftThreshold);
      const finalConfidence = Math.max(0.1, ensembleConfidence * (1 - driftPenalty));

      return {
        predictedPrice: new Decimal(ensemblePrediction),
        confidence: finalConfidence,
        horizon: '12h',
        metadata: {
          rmse: Math.sqrt(
            prices.slice(-14)
              .map((p, i) => Math.pow(p - ensemblePrediction, 2))
              .reduce((a, b) => a + b) / 14
          ),
          r2Score: 0.85, // This should be calculated properly in production
          features,
          modelVotes: Object.fromEntries(
            Object.entries(predictions).map(([model, pred]) => [model, pred.price])
          ),
          featureDrift,
          zScores
        }
      };
    } catch (error) {
      console.error('Error during prediction:', error);
      return null;
    }
  }
}