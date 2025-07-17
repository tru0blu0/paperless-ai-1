const axios = require('axios');
const FormData = require('form-data');
const paperlessService = require('./paperlessService');
const ocrProcessingModel = require('../models/ocrProcessing');
const EventEmitter = require('events');
const Logger = require('./loggerService');

const logger = new Logger({
  logFile: 'ocr-service.log',
  format: 'txt',
  timestamp: true,
  maxFileSize: 1024 * 1024 * 10
});

class OCRService extends EventEmitter {
  constructor() {
    super();
    this.ocrBaseUrl = 'http://ocr-container:8123';
    this.processingQueue = new Map();
    this.currentProcessing = null;
    this.isProcessing = false;
    this.totalDocuments = 0;
    this.processedDocuments = 0;
    this.successfulDocuments = 0;
    this.errors = [];
    this.startTime = null;
    this.shouldStop = false;
  }

  /**
   * Process a single document through OCR
   * @param {number} documentId - The document ID from Paperless-NGX
   * @returns {Promise<Object>} Result object with success status and details
   */
  async processDocument(documentId) {
    const startTime = Date.now();
    
    try {
      logger.log(`Starting OCR processing for document ${documentId}`);
      
      // 1. Get document details from Paperless-NGX
      const documentDetails = await paperlessService.getDocumentForOCR(documentId);
      if (!documentDetails) {
        throw new Error(`Document ${documentId} not found in Paperless-NGX`);
      }

      // 2. Record processing start in database
      ocrProcessingModel.recordProcessingStart(documentId, documentDetails.title);

      // 3. Download document file from Paperless-NGX
      const documentBuffer = await paperlessService.downloadDocument(documentId);
      if (!documentBuffer) {
        throw new Error(`Failed to download document ${documentId}`);
      }

      // 4. Prepare form data for OCR service
      const formData = new FormData();
      const filename = `document_${documentId}.${this.getFileExtension(documentDetails.file_type)}`;
      formData.append('file', documentBuffer, {
        filename: filename,
        contentType: this.getContentType(documentDetails.file_type)
      });

      // 5. Send to OCR service
      logger.log(`Sending document ${documentId} to OCR service`);
      const ocrResponse = await axios.post(`${this.ocrBaseUrl}/ocr/document`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        timeout: 300000, // 5 minutes timeout for OCR processing
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      // 6. Extract text from OCR response
      const extractedText = this.extractTextFromOCR(ocrResponse.data);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text extracted from OCR response');
      }

      // 7. Update document content in Paperless-NGX
      await paperlessService.updateDocumentContent(documentId, extractedText);

      const processingTime = Date.now() - startTime;
      const originalLength = documentDetails.content ? documentDetails.content.length : 0;

      // 8. Record successful processing in database
      ocrProcessingModel.recordProcessingSuccess(
        documentId,
        documentDetails.title,
        originalLength,
        extractedText.length,
        processingTime,
        ocrResponse.data
      );

      logger.log(`Successfully processed document ${documentId}, extracted ${extractedText.length} characters`);
      
      return {
        success: true,
        documentId,
        documentTitle: documentDetails.title,
        extractedText,
        textLength: extractedText.length,
        originalLength,
        processingTime,
        wasAlreadyProcessed: false
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Error processing document ${documentId}: ${error.message}`);
      
      // Get document title for error recording
      let documentTitle = `Document ${documentId}`;
      try {
        const documentDetails = await paperlessService.getDocumentForOCR(documentId);
        documentTitle = documentDetails?.title || documentTitle;
      } catch (titleError) {
        // Ignore title fetch errors
      }

      // Record failed processing in database
      ocrProcessingModel.recordProcessingFailure(
        documentId,
        documentTitle,
        error.message,
        processingTime
      );
      
      const errorDetails = {
        documentId,
        error: error.message,
        timestamp: new Date(),
        stack: error.stack
      };
      
      this.errors.push(errorDetails);
      
      return {
        success: false,
        documentId,
        documentTitle,
        error: error.message,
        timestamp: new Date(),
        processingTime
      };
    }
  }

  /**
   * Filter out already processed documents from a list
   * @param {Array<number>} documentIds - Array of document IDs to filter
   * @returns {Array<number>} Array of document IDs that haven't been processed
   */
  filterUnprocessedDocuments(documentIds) {
    if (!documentIds || documentIds.length === 0) {
      return [];
    }

    const unprocessedIds = documentIds.filter(id => !ocrProcessingModel.isDocumentProcessed(id));
    
    const processedCount = documentIds.length - unprocessedIds.length;
    if (processedCount > 0) {
      logger.log(`Filtered out ${processedCount} already processed documents`);
    }

    return unprocessedIds;
  }

  /**
   * Start batch processing of multiple documents
   * @param {Array<number>} documentIds - Array of document IDs to process
   * @param {boolean} skipProcessed - Whether to skip already processed documents (default: true)
   */
  async startBatchProcessing(documentIds, skipProcessed = true) {
    if (this.isProcessing) {
      throw new Error('Processing already in progress');
    }

    if (!documentIds || documentIds.length === 0) {
      throw new Error('No documents provided for processing');
    }

    // Filter out already processed documents if requested
    const originalCount = documentIds.length;
    const docsToProcess = skipProcessed ? this.filterUnprocessedDocuments(documentIds) : documentIds;
    
    if (docsToProcess.length === 0) {
      logger.log('All documents have already been processed');
      this.emit('processingCompleted', {
        totalDocuments: originalCount,
        processedDocuments: 0,
        successfulDocuments: 0,
        failedDocuments: 0,
        skippedDocuments: originalCount,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        duration: 0
      });
      return;
    }

    logger.log(`Starting batch OCR processing for ${docsToProcess.length} documents (${originalCount - docsToProcess.length} already processed)`);
    
    // Generate session ID for tracking
    const sessionId = `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.isProcessing = true;
    this.shouldStop = false;
    this.totalDocuments = docsToProcess.length;
    this.processedDocuments = 0;
    this.successfulDocuments = 0;
    this.errors = [];
    this.startTime = new Date();
    
    // Start processing session in database
    ocrProcessingModel.startProcessingSession(sessionId, this.totalDocuments);
    
    this.emit('processingStarted', {
      totalDocuments: this.totalDocuments,
      skippedDocuments: originalCount - docsToProcess.length,
      sessionId,
      timestamp: this.startTime
    });

    try {
      for (let i = 0; i < docsToProcess.length; i++) {
        if (this.shouldStop) {
          logger.log('Processing stopped by user request');
          break;
        }

        const documentId = docsToProcess[i];
        this.currentProcessing = {
          documentId,
          index: i + 1,
          total: docsToProcess.length
        };

        this.emit('documentStarted', {
          documentId,
          documentIndex: i + 1,
          totalDocuments: docsToProcess.length
        });

        const result = await this.processDocument(documentId);
        
        this.processedDocuments++;
        if (result.success) {
          this.successfulDocuments++;
        }

        const progress = (this.processedDocuments / this.totalDocuments) * 100;
        
        // Update session in database
        ocrProcessingModel.updateProcessingSession(
          sessionId,
          this.successfulDocuments,
          this.processedDocuments - this.successfulDocuments,
          'running'
        );
        
        this.emit('documentCompleted', {
          ...result,
          progress,
          processedDocuments: this.processedDocuments,
          totalDocuments: this.totalDocuments,
          successfulDocuments: this.successfulDocuments,
          failedDocuments: this.processedDocuments - this.successfulDocuments
        });

        // Small delay to prevent overwhelming the OCR service
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const completedData = {
        totalDocuments: this.totalDocuments,
        processedDocuments: this.processedDocuments,
        successfulDocuments: this.successfulDocuments,
        failedDocuments: this.processedDocuments - this.successfulDocuments,
        skippedDocuments: originalCount - docsToProcess.length,
        errors: this.errors,
        startTime: this.startTime,
        endTime: new Date(),
        duration: Date.now() - this.startTime.getTime(),
        sessionId
      };

      // Update session as completed
      ocrProcessingModel.updateProcessingSession(
        sessionId,
        this.successfulDocuments,
        this.processedDocuments - this.successfulDocuments,
        this.shouldStop ? 'stopped' : 'completed'
      );

      logger.log(`Batch processing completed: ${this.successfulDocuments}/${this.processedDocuments} documents successful`);
      
      this.emit('processingCompleted', completedData);
      
    } catch (error) {
      logger.error(`Batch processing failed: ${error.message}`);
      
      // Update session as failed
      ocrProcessingModel.updateProcessingSession(
        sessionId,
        this.successfulDocuments,
        this.processedDocuments - this.successfulDocuments,
        'failed'
      );
      
      this.emit('processingError', {
        error: error.message,
        timestamp: new Date(),
        sessionId
      });
    } finally {
      this.isProcessing = false;
      this.currentProcessing = null;
      this.shouldStop = false;
    }
  }

  /**
   * Stop the current processing
   */
  stopProcessing() {
    if (!this.isProcessing) {
      return false;
    }

    logger.log('Stopping OCR processing');
    this.shouldStop = true;
    
    const stoppedData = {
      processedDocuments: this.processedDocuments,
      totalDocuments: this.totalDocuments,
      successfulDocuments: this.successfulDocuments,
      timestamp: new Date()
    };
    
    this.emit('processingStopped', stoppedData);
    
    return true;
  }

  /**
   * Get current processing status
   * @returns {Object} Current status
   */
  getStatus() {
    const now = new Date();
    let estimatedCompletion = null;
    
    if (this.isProcessing && this.processedDocuments > 0) {
      const elapsed = now.getTime() - this.startTime.getTime();
      const avgTimePerDoc = elapsed / this.processedDocuments;
      const remainingDocs = this.totalDocuments - this.processedDocuments;
      estimatedCompletion = new Date(now.getTime() + (remainingDocs * avgTimePerDoc));
    }

    return {
      isProcessing: this.isProcessing,
      currentProcessing: this.currentProcessing,
      totalDocuments: this.totalDocuments,
      processedDocuments: this.processedDocuments,
      successfulDocuments: this.successfulDocuments,
      failedDocuments: this.processedDocuments - this.successfulDocuments,
      progress: this.totalDocuments > 0 ? (this.processedDocuments / this.totalDocuments) * 100 : 0,
      errors: this.errors,
      startTime: this.startTime,
      estimatedCompletion,
      shouldStop: this.shouldStop
    };
  }

  /**
   * Test OCR service availability
   * @returns {Promise<boolean>} True if service is available
   */
  async testOCRService() {
    try {
      const response = await axios.get(`${this.ocrBaseUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.error(`OCR service health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract text from OCR response
   * @param {Object} ocrResponse - OCR service response
   * @returns {string} Combined text from all recognized text lines
   */
  extractTextFromOCR(ocrResponse) {
    if (!ocrResponse || !ocrResponse.rec_texts || !Array.isArray(ocrResponse.rec_texts)) {
      throw new Error('Invalid OCR response format - missing rec_texts array');
    }

    if (ocrResponse.rec_texts.length === 0) {
      throw new Error('No text recognized in document');
    }

    // Combine all text lines into a single document
    const combinedText = ocrResponse.rec_texts
      .filter(text => text && typeof text === 'string') // Filter out null/undefined/non-string values
      .map(text => text.trim()) // Trim whitespace
      .filter(text => text.length > 0) // Remove empty lines
      .join('\n'); // Join with newlines

    return combinedText;
  }

  /**
   * Get file extension based on file type
   * @param {string} fileType - File type from Paperless-NGX
   * @returns {string} File extension
   */
  getFileExtension(fileType) {
    const extensions = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/tiff': 'tiff',
      'image/bmp': 'bmp',
      'image/gif': 'gif'
    };
    
    return extensions[fileType] || 'pdf';
  }

  /**
   * Get content type based on file type
   * @param {string} fileType - File type from Paperless-NGX
   * @returns {string} Content type
   */
  getContentType(fileType) {
    return fileType || 'application/pdf';
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  getStatistics() {
    const dbStats = ocrProcessingModel.getProcessingStatistics();
    
    return {
      // Current session stats
      currentSession: {
        totalProcessed: this.processedDocuments,
        successful: this.successfulDocuments,
        failed: this.errors.length,
        successRate: this.processedDocuments > 0 ? (this.successfulDocuments / this.processedDocuments) * 100 : 0,
        errors: this.errors.map(error => ({
          documentId: error.documentId,
          error: error.error,
          timestamp: error.timestamp
        }))
      },
      // Overall database stats
      overall: dbStats
    };
  }

  /**
   * Get documents that have been successfully processed
   * @returns {number[]} Array of processed document IDs
   */
  getProcessedDocumentIds() {
    return ocrProcessingModel.getProcessedDocumentIds();
  }

  /**
   * Check if a document has been processed
   * @param {number} documentId - Document ID to check
   * @returns {boolean} True if document has been processed
   */
  isDocumentProcessed(documentId) {
    return ocrProcessingModel.isDocumentProcessed(documentId);
  }

  /**
   * Get processing history for a document
   * @param {number} documentId - Document ID
   * @returns {Object[]} Processing history
   */
  getDocumentProcessingHistory(documentId) {
    return ocrProcessingModel.getDocumentProcessingHistory(documentId);
  }

  /**
   * Get recent processing history
   * @param {number} limit - Number of records to retrieve
   * @returns {Object[]} Recent processing history
   */
  getRecentProcessingHistory(limit = 50) {
    return ocrProcessingModel.getRecentProcessingHistory(limit);
  }

  /**
   * Reset processing status for a document
   * @param {number} documentId - Document ID to reset
   */
  resetDocumentProcessing(documentId) {
    ocrProcessingModel.resetDocumentProcessing(documentId);
  }

  /**
   * Reset all processing history
   */
  resetAllProcessing() {
    ocrProcessingModel.resetAllProcessing();
  }
}

module.exports = new OCRService();