const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class OCRProcessingModel {
  constructor() {
    this.db = null;
    this.initializeDatabase();
  }

  initializeDatabase() {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      
      // Ensure data directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const dbPath = path.join(dataDir, 'ocr_processing.db');
      this.db = new Database(dbPath);
      
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');
      
      this.createTables();
      console.log('[OCR DB] Database initialized successfully');
    } catch (error) {
      console.error('[OCR DB] Failed to initialize database:', error);
      throw error;
    }
  }

  createTables() {
    // Create OCR processing history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ocr_processing_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        document_title TEXT,
        processing_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'processing')),
        original_content_length INTEGER,
        extracted_content_length INTEGER,
        processing_time_ms INTEGER,
        error_message TEXT,
        ocr_service_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ocr_document_id ON ocr_processing_history(document_id);
      CREATE INDEX IF NOT EXISTS idx_ocr_status ON ocr_processing_history(status);
      CREATE INDEX IF NOT EXISTS idx_ocr_processing_date ON ocr_processing_history(processing_date);
    `);

    // Create OCR processing sessions table for batch tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ocr_processing_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        total_documents INTEGER NOT NULL,
        successful_documents INTEGER DEFAULT 0,
        failed_documents INTEGER DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'stopped', 'failed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for sessions
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ocr_session_id ON ocr_processing_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_ocr_session_status ON ocr_processing_sessions(status);
    `);
  }

  /**
   * Check if a document has been successfully processed
   * @param {number} documentId - Document ID to check
   * @returns {boolean} True if document was successfully processed
   */
  isDocumentProcessed(documentId) {
    try {
      const stmt = this.db.prepare(`
        SELECT 1 FROM ocr_processing_history 
        WHERE document_id = ? AND status = 'success'
        ORDER BY processing_date DESC
        LIMIT 1
      `);
      
      const result = stmt.get(documentId);
      return !!result;
    } catch (error) {
      console.error(`[OCR DB] Error checking if document ${documentId} is processed:`, error);
      return false;
    }
  }

  /**
   * Get list of successfully processed document IDs
   * @returns {number[]} Array of document IDs that were successfully processed
   */
  getProcessedDocumentIds() {
    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT document_id 
        FROM ocr_processing_history 
        WHERE status = 'success'
        ORDER BY document_id
      `);
      
      const results = stmt.all();
      return results.map(row => row.document_id);
    } catch (error) {
      console.error('[OCR DB] Error getting processed document IDs:', error);
      return [];
    }
  }

  /**
   * Record OCR processing start
   * @param {number} documentId - Document ID
   * @param {string} documentTitle - Document title
   * @returns {number} Record ID
   */
  recordProcessingStart(documentId, documentTitle) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ocr_processing_history (
          document_id, document_title, status, processing_date
        ) VALUES (?, ?, 'processing', CURRENT_TIMESTAMP)
      `);
      
      const result = stmt.run(documentId, documentTitle);
      return result.lastInsertRowid;
    } catch (error) {
      console.error(`[OCR DB] Error recording processing start for document ${documentId}:`, error);
      return null;
    }
  }

  /**
   * Record successful OCR processing
   * @param {number} documentId - Document ID
   * @param {string} documentTitle - Document title
   * @param {number} originalContentLength - Original content length
   * @param {number} extractedContentLength - Extracted content length
   * @param {number} processingTimeMs - Processing time in milliseconds
   * @param {Object} ocrResponse - OCR service response
   */
  recordProcessingSuccess(documentId, documentTitle, originalContentLength, extractedContentLength, processingTimeMs, ocrResponse) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ocr_processing_history (
          document_id, document_title, status, processing_date,
          original_content_length, extracted_content_length, processing_time_ms,
          ocr_service_response, created_at, updated_at
        ) VALUES (?, ?, 'success', CURRENT_TIMESTAMP, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      const ocrResponseJson = JSON.stringify({
        rec_texts_count: ocrResponse.rec_texts ? ocrResponse.rec_texts.length : 0,
        processing_info: {
          model_settings: ocrResponse.model_settings,
          text_type: ocrResponse.text_type
        }
      });
      
      stmt.run(
        documentId, 
        documentTitle, 
        originalContentLength, 
        extractedContentLength, 
        processingTimeMs,
        ocrResponseJson
      );
      
      console.log(`[OCR DB] Recorded successful processing for document ${documentId}`);
    } catch (error) {
      console.error(`[OCR DB] Error recording processing success for document ${documentId}:`, error);
    }
  }

  /**
   * Record failed OCR processing
   * @param {number} documentId - Document ID
   * @param {string} documentTitle - Document title
   * @param {string} errorMessage - Error message
   * @param {number} processingTimeMs - Processing time in milliseconds
   */
  recordProcessingFailure(documentId, documentTitle, errorMessage, processingTimeMs) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ocr_processing_history (
          document_id, document_title, status, processing_date,
          error_message, processing_time_ms, created_at, updated_at
        ) VALUES (?, ?, 'failed', CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(documentId, documentTitle, errorMessage, processingTimeMs);
      console.log(`[OCR DB] Recorded failed processing for document ${documentId}`);
    } catch (error) {
      console.error(`[OCR DB] Error recording processing failure for document ${documentId}:`, error);
    }
  }

  /**
   * Get processing history for a document
   * @param {number} documentId - Document ID
   * @returns {Object[]} Processing history records
   */
  getDocumentProcessingHistory(documentId) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ocr_processing_history 
        WHERE document_id = ? 
        ORDER BY processing_date DESC
      `);
      
      return stmt.all(documentId);
    } catch (error) {
      console.error(`[OCR DB] Error getting processing history for document ${documentId}:`, error);
      return [];
    }
  }

  /**
   * Get OCR processing statistics
   * @returns {Object} Processing statistics
   */
  getProcessingStatistics() {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_processed,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          AVG(CASE WHEN status = 'success' THEN processing_time_ms END) as avg_processing_time_ms,
          MAX(processing_date) as last_processing_date
        FROM ocr_processing_history
      `);
      
      const result = stmt.get();
      
      return {
        totalProcessed: result.total_processed || 0,
        successful: result.successful || 0,
        failed: result.failed || 0,
        successRate: result.total_processed > 0 ? ((result.successful / result.total_processed) * 100).toFixed(2) : 0,
        avgProcessingTimeMs: result.avg_processing_time_ms || 0,
        lastProcessingDate: result.last_processing_date
      };
    } catch (error) {
      console.error('[OCR DB] Error getting processing statistics:', error);
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        avgProcessingTimeMs: 0,
        lastProcessingDate: null
      };
    }
  }

  /**
   * Reset processing status for a document (mark as not processed)
   * @param {number} documentId - Document ID to reset
   */
  resetDocumentProcessing(documentId) {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM ocr_processing_history WHERE document_id = ?
      `);
      
      stmt.run(documentId);
      console.log(`[OCR DB] Reset processing status for document ${documentId}`);
    } catch (error) {
      console.error(`[OCR DB] Error resetting processing status for document ${documentId}:`, error);
    }
  }

  /**
   * Reset all processing history
   */
  resetAllProcessing() {
    try {
      const stmt = this.db.prepare(`DELETE FROM ocr_processing_history`);
      stmt.run();
      console.log('[OCR DB] Reset all processing history');
    } catch (error) {
      console.error('[OCR DB] Error resetting all processing history:', error);
    }
  }

  /**
   * Get recent processing history
   * @param {number} limit - Number of records to retrieve
   * @returns {Object[]} Recent processing records
   */
  getRecentProcessingHistory(limit = 50) {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          document_id, document_title, status, processing_date,
          original_content_length, extracted_content_length, processing_time_ms,
          error_message
        FROM ocr_processing_history 
        ORDER BY processing_date DESC 
        LIMIT ?
      `);
      
      return stmt.all(limit);
    } catch (error) {
      console.error('[OCR DB] Error getting recent processing history:', error);
      return [];
    }
  }

  /**
   * Start a new processing session
   * @param {string} sessionId - Unique session ID
   * @param {number} totalDocuments - Total documents to process
   * @returns {number} Session record ID
   */
  startProcessingSession(sessionId, totalDocuments) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ocr_processing_sessions (
          session_id, total_documents, status
        ) VALUES (?, ?, 'running')
      `);
      
      const result = stmt.run(sessionId, totalDocuments);
      return result.lastInsertRowid;
    } catch (error) {
      console.error(`[OCR DB] Error starting processing session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update processing session
   * @param {string} sessionId - Session ID
   * @param {number} successful - Number of successful documents
   * @param {number} failed - Number of failed documents
   * @param {string} status - Session status
   */
  updateProcessingSession(sessionId, successful, failed, status) {
    try {
      const stmt = this.db.prepare(`
        UPDATE ocr_processing_sessions 
        SET successful_documents = ?, failed_documents = ?, status = ?, 
            completed_at = CASE WHEN ? IN ('completed', 'stopped', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `);
      
      stmt.run(successful, failed, status, status, sessionId);
    } catch (error) {
      console.error(`[OCR DB] Error updating processing session ${sessionId}:`, error);
    }
  }

  /**
   * Close database connection
   */
  closeDatabase() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[OCR DB] Database connection closed');
    }
  }
}

module.exports = new OCRProcessingModel();