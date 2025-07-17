const express = require('express');
const router = express.Router();
const ocrService = require('../services/ocrService');
const paperlessService = require('../services/paperlessService');
const { authenticateJWT } = require('./auth');

/**
 * @swagger
 * /api/ocr/documents:
 *   get:
 *     summary: Get documents available for OCR reprocessing
 *     description: |
 *       Retrieves all documents from Paperless-NGX that are available for OCR reprocessing.
 *       Returns document metadata including ID, title, creation date, correspondent, and file type.
 *       
 *       This endpoint is used to populate the document selection interface in the OCR management page.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 123
 *                       title:
 *                         type: string
 *                         example: "Invoice_2024_001.pdf"
 *                       created:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *                       correspondent:
 *                         type: string
 *                         example: "Acme Corporation"
 *                       document_type:
 *                         type: string
 *                         example: "Invoice"
 *                       file_type:
 *                         type: string
 *                         example: "application/pdf"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error occurred while retrieving documents
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/documents', authenticateJWT, async (req, res) => {
  try {
    const { includeProcessed = 'false' } = req.query;
    const documents = await paperlessService.getAllDocuments();
    
    // Get processed document IDs
    const processedIds = ocrService.getProcessedDocumentIds();
    
    // Map documents with processing status
    const documentsWithStatus = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      created: doc.created,
      correspondent: doc.correspondent,
      document_type: doc.document_type,
      file_type: doc.file_type || 'application/pdf',
      isProcessed: processedIds.includes(doc.id)
    }));
    
    // Filter documents based on includeProcessed parameter
    const filteredDocuments = includeProcessed === 'true' 
      ? documentsWithStatus 
      : documentsWithStatus.filter(doc => !doc.isProcessed);
    
    res.json({
      success: true,
      documents: filteredDocuments,
      totalDocuments: documents.length,
      processedDocuments: processedIds.length,
      unprocessedDocuments: documents.length - processedIds.length
    });
  } catch (error) {
    console.error('Error retrieving documents for OCR:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/process:
 *   post:
 *     summary: Start OCR processing for selected documents
 *     description: |
 *       Initiates OCR reprocessing for the specified documents. The processing runs asynchronously
 *       in the background, and progress can be monitored via the events endpoint or status endpoint.
 *       
 *       Each document will be downloaded from Paperless-NGX, sent to the OCR service, and the
 *       extracted text will be saved back to Paperless-NGX, replacing the original content.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentIds
 *             properties:
 *               documentIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of document IDs to process
 *                 example: [123, 456, 789]
 *     responses:
 *       200:
 *         description: OCR processing started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OCR processing started"
 *                 totalDocuments:
 *                   type: integer
 *                   example: 3
 *       400:
 *         description: Invalid request - missing or invalid documentIds
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "documentIds array is required"
 *       409:
 *         description: Processing already in progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Processing already in progress"
 *       500:
 *         description: Server error occurred while starting processing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/process', authenticateJWT, async (req, res) => {
  try {
    const { documentIds, skipProcessed = true } = req.body;
    
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'documentIds array is required and must not be empty' 
      });
    }

    // Validate that all documentIds are numbers
    const invalidIds = documentIds.filter(id => !Number.isInteger(id) || id <= 0);
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid document IDs: ${invalidIds.join(', ')}`
      });
    }

    // Check if processing is already in progress
    const status = ocrService.getStatus();
    if (status.isProcessing) {
      return res.status(409).json({
        success: false,
        error: 'Processing already in progress'
      });
    }

    // Filter documents if skipProcessed is true
    const docsToProcess = skipProcessed ? ocrService.filterUnprocessedDocuments(documentIds) : documentIds;
    
    if (docsToProcess.length === 0) {
      return res.json({
        success: true,
        message: 'No documents need processing (all already processed)',
        totalDocuments: documentIds.length,
        documentsToProcess: 0,
        skippedDocuments: documentIds.length
      });
    }

    // Start processing in background
    setTimeout(() => {
      ocrService.startBatchProcessing(documentIds, skipProcessed);
    }, 100);
    
    res.json({ 
      success: true, 
      message: 'OCR processing started',
      totalDocuments: documentIds.length,
      documentsToProcess: docsToProcess.length,
      skippedDocuments: documentIds.length - docsToProcess.length
    });
  } catch (error) {
    console.error('Error starting OCR processing:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/status:
 *   get:
 *     summary: Get current OCR processing status
 *     description: |
 *       Returns the current status of OCR processing including progress information,
 *       processed document counts, error details, and estimated completion time.
 *       
 *       Use this endpoint to check processing status without establishing a persistent connection.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: object
 *                   properties:
 *                     isProcessing:
 *                       type: boolean
 *                       example: true
 *                     currentProcessing:
 *                       type: object
 *                       properties:
 *                         documentId:
 *                           type: integer
 *                           example: 123
 *                         index:
 *                           type: integer
 *                           example: 2
 *                         total:
 *                           type: integer
 *                           example: 5
 *                     totalDocuments:
 *                       type: integer
 *                       example: 5
 *                     processedDocuments:
 *                       type: integer
 *                       example: 2
 *                     successfulDocuments:
 *                       type: integer
 *                       example: 2
 *                     failedDocuments:
 *                       type: integer
 *                       example: 0
 *                     progress:
 *                       type: number
 *                       example: 40.0
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:35:00Z"
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           documentId:
 *                             type: integer
 *                           error:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *       500:
 *         description: Server error occurred while retrieving status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/status', authenticateJWT, (req, res) => {
  try {
    const status = ocrService.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Error retrieving OCR status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/stop:
 *   post:
 *     summary: Stop current OCR processing
 *     description: |
 *       Stops the current OCR processing operation. The processing will stop after the
 *       current document is completed. Already processed documents will remain updated.
 *       
 *       This is a graceful stop that doesn't interrupt the current document processing.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Processing stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Processing stopped"
 *                 processedDocuments:
 *                   type: integer
 *                   example: 3
 *                 totalDocuments:
 *                   type: integer
 *                   example: 10
 *       400:
 *         description: No processing in progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "No processing in progress"
 *       500:
 *         description: Server error occurred while stopping processing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/stop', authenticateJWT, (req, res) => {
  try {
    const stopped = ocrService.stopProcessing();
    
    if (stopped) {
      const status = ocrService.getStatus();
      res.json({ 
        success: true, 
        message: 'Processing stopped',
        processedDocuments: status.processedDocuments,
        totalDocuments: status.totalDocuments
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'No processing in progress'
      });
    }
  } catch (error) {
    console.error('Error stopping OCR processing:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/health:
 *   get:
 *     summary: Check OCR service health
 *     description: |
 *       Checks if the OCR service container is available and responding.
 *       This endpoint tests the connection to the OCR service at port 8123.
 *       
 *       Use this endpoint to verify OCR service availability before starting processing.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: OCR service health check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 available:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OCR service is available"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *       500:
 *         description: Server error occurred during health check
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/health', authenticateJWT, async (req, res) => {
  try {
    const available = await ocrService.testOCRService();
    res.json({
      success: true,
      available: available,
      message: available ? 'OCR service is available' : 'OCR service is not available',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error checking OCR service health:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/statistics:
 *   get:
 *     summary: Get OCR processing statistics
 *     description: |
 *       Returns statistics about OCR processing including success rates, error counts,
 *       and processing history. This provides insights into OCR performance and reliability.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalProcessed:
 *                       type: integer
 *                       example: 150
 *                     successful:
 *                       type: integer
 *                       example: 142
 *                     failed:
 *                       type: integer
 *                       example: 8
 *                     successRate:
 *                       type: number
 *                       example: 94.67
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           documentId:
 *                             type: integer
 *                           error:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *       500:
 *         description: Server error occurred while retrieving statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/statistics', authenticateJWT, (req, res) => {
  try {
    const statistics = ocrService.getStatistics();
    res.json({
      success: true,
      statistics: statistics
    });
  } catch (error) {
    console.error('Error retrieving OCR statistics:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/events:
 *   get:
 *     summary: Server-Sent Events for real-time OCR processing updates
 *     description: |
 *       Establishes a Server-Sent Events connection for real-time updates during OCR processing.
 *       This endpoint streams processing events including document start/completion, progress updates,
 *       and error notifications.
 *       
 *       Event types:
 *       - `status`: Current processing status
 *       - `processingStarted`: Processing has begun
 *       - `documentStarted`: Starting to process a specific document
 *       - `documentCompleted`: Finished processing a document (success or failure)
 *       - `processingCompleted`: All documents processed
 *       - `processingStopped`: Processing stopped by user
 *       - `processingError`: Fatal error during processing
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Server-Sent Events stream established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 event: status
 *                 data: {"isProcessing":true,"progress":25.5,"currentProcessing":{"documentId":123}}
 *                 
 *                 event: documentCompleted
 *                 data: {"success":true,"documentId":123,"progress":50.0}
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/events', authenticateJWT, (req, res) => {
  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial status
  try {
    sendEvent('status', ocrService.getStatus());
  } catch (error) {
    console.error('Error sending initial OCR status:', error);
  }

  // Listen for OCR service events
  const eventHandlers = {
    processingStarted: (data) => sendEvent('processingStarted', data),
    documentStarted: (data) => sendEvent('documentStarted', data),
    documentCompleted: (data) => sendEvent('documentCompleted', data),
    processingCompleted: (data) => sendEvent('processingCompleted', data),
    processingStopped: (data) => sendEvent('processingStopped', data),
    processingError: (data) => sendEvent('processingError', data)
  };

  // Attach event listeners
  Object.entries(eventHandlers).forEach(([event, handler]) => {
    ocrService.on(event, handler);
  });

  // Send periodic heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      sendEvent('heartbeat', { timestamp: new Date() });
    } catch (error) {
      console.error('Error sending heartbeat:', error);
      clearInterval(heartbeat);
    }
  }, 30000); // Every 30 seconds

  // Cleanup on disconnect
  req.on('close', () => {
    console.log('OCR events client disconnected');
    clearInterval(heartbeat);
    
    // Remove event listeners
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      ocrService.removeListener(event, handler);
    });
  });

  req.on('error', (error) => {
    console.error('OCR events stream error:', error);
    clearInterval(heartbeat);
  });
});

/**
 * @swagger
 * /api/ocr/processed:
 *   get:
 *     summary: Get list of processed documents
 *     description: |
 *       Returns a list of document IDs that have been successfully processed by OCR.
 *       This endpoint is useful for checking which documents have already been processed.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Processed documents list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 processedDocuments:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   example: [123, 456, 789]
 *                 count:
 *                   type: integer
 *                   example: 3
 *       500:
 *         description: Server error occurred while retrieving processed documents
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/processed', authenticateJWT, (req, res) => {
  try {
    const processedDocuments = ocrService.getProcessedDocumentIds();
    res.json({
      success: true,
      processedDocuments: processedDocuments,
      count: processedDocuments.length
    });
  } catch (error) {
    console.error('Error retrieving processed documents:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/processed/{documentId}:
 *   get:
 *     summary: Get processed document text
 *     description: |
 *       Retrieves the processed text for a specific document including both structured text and markdown.
 *       Returns the original extracted text and formatted markdown text if available.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The document ID to get processed text for
 *         example: 123
 *     responses:
 *       200:
 *         description: Processed document text retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 processing:
 *                   type: object
 *                   properties:
 *                     document_id:
 *                       type: integer
 *                     document_title:
 *                       type: string
 *                     extracted_text:
 *                       type: string
 *                     markdown_text:
 *                       type: string
 *                     processing_date:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Document not found or not processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error occurred while retrieving processed text
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/processed/:documentId', authenticateJWT, (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const processing = ocrService.getProcessedDocumentText(documentId);
    
    if (!processing) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or not processed'
      });
    }
    
    res.json({
      success: true,
      processing: processing
    });
  } catch (error) {
    console.error('Error retrieving processed document text:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/ocr/processed/{documentId}:
 *   delete:
 *     summary: Reset processing status for a specific document
 *     description: |
 *       Removes the processing status for a specific document, allowing it to be processed again.
 *       This is useful when you want to reprocess a document that was previously processed.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The document ID to reset
 *         example: 123
 *     responses:
 *       200:
 *         description: Document processing status reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document processing status reset"
 *                 documentId:
 *                   type: integer
 *                   example: 123
 *       400:
 *         description: Invalid document ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid document ID"
 *       500:
 *         description: Server error occurred while resetting document status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/processed/:documentId', authenticateJWT, (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    ocrService.resetDocumentProcessing(documentId);
    
    res.json({
      success: true,
      message: 'Document processing status reset',
      documentId: documentId
    });
  } catch (error) {
    console.error(`Error resetting document ${req.params.documentId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/processed:
 *   delete:
 *     summary: Reset all processing history
 *     description: |
 *       Clears all OCR processing history, allowing all documents to be processed again.
 *       This is useful when you want to start fresh or when there were issues with previous processing.
 *       
 *       **Warning**: This action cannot be undone and will remove all processing history.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: All processing history reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All processing history reset"
 *       500:
 *         description: Server error occurred while resetting all processing history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/processed', authenticateJWT, (req, res) => {
  try {
    ocrService.resetAllProcessing();
    
    res.json({
      success: true,
      message: 'All processing history reset'
    });
  } catch (error) {
    console.error('Error resetting all processing history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/history:
 *   get:
 *     summary: Get recent processing history
 *     description: |
 *       Returns recent OCR processing history including successful and failed attempts.
 *       This provides detailed information about processing attempts for debugging and monitoring.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of history records to return
 *         example: 25
 *     responses:
 *       200:
 *         description: Processing history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       document_id:
 *                         type: integer
 *                         example: 123
 *                       document_title:
 *                         type: string
 *                         example: "Invoice_2024_001.pdf"
 *                       status:
 *                         type: string
 *                         enum: [success, failed, processing]
 *                         example: "success"
 *                       processing_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *                       processing_time_ms:
 *                         type: integer
 *                         example: 2500
 *                       original_content_length:
 *                         type: integer
 *                         example: 1200
 *                       extracted_content_length:
 *                         type: integer
 *                         example: 1150
 *                       error_message:
 *                         type: string
 *                         example: null
 *                 count:
 *                   type: integer
 *                   example: 25
 *       500:
 *         description: Server error occurred while retrieving processing history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/history', authenticateJWT, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = ocrService.getRecentProcessingHistory(limit);
    
    res.json({
      success: true,
      history: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error retrieving processing history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/ocr/history/{documentId}:
 *   get:
 *     summary: Get processing history for a specific document
 *     description: |
 *       Returns the complete processing history for a specific document, including all attempts.
 *       This is useful for debugging issues with specific documents.
 *     tags: [API, OCR]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The document ID to get history for
 *         example: 123
 *     responses:
 *       200:
 *         description: Document processing history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 documentId:
 *                   type: integer
 *                   example: 123
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       status:
 *                         type: string
 *                         enum: [success, failed, processing]
 *                         example: "success"
 *                       processing_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *                       processing_time_ms:
 *                         type: integer
 *                         example: 2500
 *                       error_message:
 *                         type: string
 *                         example: null
 *                 count:
 *                   type: integer
 *                   example: 1
 *       400:
 *         description: Invalid document ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid document ID"
 *       500:
 *         description: Server error occurred while retrieving document history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/history/:documentId', authenticateJWT, (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    const history = ocrService.getDocumentProcessingHistory(documentId);
    
    res.json({
      success: true,
      documentId: documentId,
      history: history,
      count: history.length
    });
  } catch (error) {
    console.error(`Error retrieving history for document ${req.params.documentId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;