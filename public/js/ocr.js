class OCRManager {
    constructor() {
        this.documents = [];
        this.selectedDocuments = new Set();
        this.eventSource = null;
        this.isProcessing = false;
        this.autoScroll = true;
        this.logEntries = [];
        this.ocrServiceAvailable = false;
        
        this.initializeElements();
        this.initializeEventListeners();
        this.checkOCRServiceHealth();
        this.loadDocuments();
        this.initializeSSE();
    }

    initializeElements() {
        // Main UI elements
        this.statusCard = document.getElementById('statusCard');
        this.progressBar = document.getElementById('progressBar');
        this.progressBadge = document.getElementById('progressBadge');
        this.currentDoc = document.getElementById('currentDoc');
        this.estimatedTime = document.getElementById('estimatedTime');
        this.healthIndicator = document.getElementById('healthIndicator');
        
        // Control buttons
        this.processAllBtn = document.getElementById('processAllBtn');
        this.processSelectedBtn = document.getElementById('processSelectedBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.clearLogBtn = document.getElementById('clearLogBtn');
        this.resetAllBtn = document.getElementById('resetAllBtn');
        this.autoScrollBtn = document.getElementById('autoScrollBtn');
        this.downloadLogBtn = document.getElementById('downloadLogBtn');
        
        // Table elements
        this.selectAllCheckbox = document.getElementById('selectAll');
        this.showProcessedCheckbox = document.getElementById('showProcessed');
        this.documentsTable = document.getElementById('documentsTable');
        this.selectionCount = document.getElementById('selectionCount');
        this.documentStats = document.getElementById('documentStats');
        
        // Log elements
        this.processingLog = document.getElementById('processingLog');
        
        // Modal elements
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.confirmCancel = document.getElementById('confirmCancel');
        this.confirmProceed = document.getElementById('confirmProceed');
        
        // Toast container
        this.toastContainer = document.getElementById('toastContainer');
    }

    initializeEventListeners() {
        // Control button listeners
        this.processAllBtn.addEventListener('click', () => this.confirmProcessAll());
        this.processSelectedBtn.addEventListener('click', () => this.confirmProcessSelected());
        this.stopBtn.addEventListener('click', () => this.stopProcessing());
        this.refreshBtn.addEventListener('click', () => this.refreshData());
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
        this.resetAllBtn.addEventListener('click', () => this.confirmResetAll());
        this.autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
        this.downloadLogBtn.addEventListener('click', () => this.downloadLog());
        
        // Table listeners
        this.selectAllCheckbox.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        this.showProcessedCheckbox.addEventListener('change', () => this.loadDocuments());
        
        // Modal listeners
        this.confirmCancel.addEventListener('click', () => this.hideConfirmModal());
        this.confirmProceed.addEventListener('click', () => this.executeConfirmedAction());
        
        // Close modal on overlay click
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) {
                this.hideConfirmModal();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'a' && !this.isProcessing) {
                e.preventDefault();
                this.selectAllCheckbox.checked = !this.selectAllCheckbox.checked;
                this.toggleSelectAll(this.selectAllCheckbox.checked);
            }
            if (e.key === 'Escape') {
                this.hideConfirmModal();
            }
        });
    }

    async checkOCRServiceHealth() {
        try {
            this.updateHealthIndicator('checking', 'Checking OCR Service...');
            
            const response = await fetch('/api/ocr/health');
            const data = await response.json();
            
            if (data.success && data.available) {
                this.ocrServiceAvailable = true;
                this.updateHealthIndicator('available', 'OCR Service Available');
            } else {
                this.ocrServiceAvailable = false;
                this.updateHealthIndicator('unavailable', 'OCR Service Unavailable');
            }
        } catch (error) {
            this.ocrServiceAvailable = false;
            this.updateHealthIndicator('unavailable', 'OCR Service Error');
            console.error('Error checking OCR service health:', error);
        }
    }

    updateHealthIndicator(status, message) {
        const indicator = this.healthIndicator;
        const icon = indicator.querySelector('i');
        const text = indicator.querySelector('span');
        
        // Remove all status classes
        indicator.classList.remove('health-available', 'health-unavailable', 'health-checking');
        
        switch (status) {
            case 'available':
                indicator.classList.add('health-available');
                icon.className = 'fas fa-check-circle';
                break;
            case 'unavailable':
                indicator.classList.add('health-unavailable');
                icon.className = 'fas fa-exclamation-triangle';
                break;
            case 'checking':
                indicator.classList.add('health-checking');
                icon.className = 'fas fa-spinner fa-spin';
                break;
        }
        
        text.textContent = message;
    }

    async loadDocuments() {
        try {
            this.showTableLoading();
            
            const includeProcessed = this.showProcessedCheckbox.checked;
            const response = await fetch(`/api/ocr/documents?includeProcessed=${includeProcessed}`);
            const data = await response.json();
            
            if (data.success) {
                this.documents = data.documents;
                this.renderDocuments();
                
                // Update document stats
                this.updateDocumentStats(data.totalDocuments, data.processedDocuments, data.unprocessedDocuments);
                
                this.addLogEntry(`Loaded ${this.documents.length} documents (${data.processedDocuments} processed, ${data.unprocessedDocuments} unprocessed)`, 'info');
            } else {
                this.showError('Failed to load documents: ' + data.error);
            }
        } catch (error) {
            this.showError('Error loading documents: ' + error.message);
            console.error('Error loading documents:', error);
        }
    }

    showTableLoading() {
        this.documentsTable.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8">
                    <div class="flex items-center justify-center gap-2">
                        <i class="fas fa-spinner fa-spin text-blue-500"></i>
                        <span>Loading documents...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    updateDocumentStats(total, processed, unprocessed) {
        const processedPercentage = total > 0 ? Math.round((processed / total) * 100) : 0;
        this.documentStats.innerHTML = `
            <span class="text-blue-600 font-medium">${total}</span> total, 
            <span class="text-green-600 font-medium">${processed}</span> processed (${processedPercentage}%), 
            <span class="text-gray-600 font-medium">${unprocessed}</span> remaining
        `;
    }

    renderDocuments() {
        const tbody = this.documentsTable;
        tbody.innerHTML = '';

        if (this.documents.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-documents">
                        <i class="fas fa-file-alt text-gray-300 text-4xl mb-2"></i>
                        <div>No documents found</div>
                    </td>
                </tr>
            `;
            return;
        }

        this.documents.forEach(doc => {
            const row = document.createElement('tr');
            row.className = `border-b document-row ${doc.isProcessed ? 'document-processed' : ''}`;
            
            const createdDate = new Date(doc.created).toLocaleDateString();
            const correspondentName = doc.correspondent || 'Unknown';
            const documentType = doc.document_type || 'Unknown';
            
            // Determine status
            let statusClass, statusIcon, statusText;
            if (doc.isProcessed) {
                statusClass = 'status-processed';
                statusIcon = 'fas fa-check-circle text-xs';
                statusText = 'Processed';
            } else {
                statusClass = 'status-ready';
                statusIcon = 'fas fa-circle text-xs';
                statusText = 'Ready';
            }
            
            row.innerHTML = `
                <td class="p-3">
                    <input type="checkbox" 
                           class="document-checkbox" 
                           data-doc-id="${doc.id}"
                           ${this.selectedDocuments.has(doc.id) ? 'checked' : ''}
                           ${this.isProcessing ? 'disabled' : ''}>
                </td>
                <td class="p-3 font-mono text-sm">${doc.id}</td>
                <td class="p-3">
                    <div class="truncate max-w-xs" title="${doc.title}">
                        ${doc.title}
                    </div>
                </td>
                <td class="p-3 text-sm">${documentType}</td>
                <td class="p-3 text-sm">${createdDate}</td>
                <td class="p-3">
                    <span class="status-badge ${statusClass} document-status" data-doc-id="${doc.id}">
                        <i class="${statusIcon}"></i>
                        <span>${statusText}</span>
                    </span>
                </td>
                <td class="p-3">
                    ${doc.isProcessed ? `
                        <button class="reset-btn" 
                                data-doc-id="${doc.id}" 
                                title="Reset processing status"
                                ${this.isProcessing ? 'disabled' : ''}>
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            
            tbody.appendChild(row);
        });

        // Add event listeners to checkboxes
        document.querySelectorAll('.document-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const docId = parseInt(e.target.dataset.docId);
                if (e.target.checked) {
                    this.selectedDocuments.add(docId);
                } else {
                    this.selectedDocuments.delete(docId);
                }
                this.updateSelectionUI();
            });
        });

        // Add event listeners to reset buttons
        document.querySelectorAll('.reset-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const docId = parseInt(e.target.closest('.reset-btn').dataset.docId);
                this.confirmResetDocument(docId);
            });
        });

        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const selectedCount = this.selectedDocuments.size;
        const totalCount = this.documents.length;
        
        this.selectionCount.textContent = `${selectedCount} document${selectedCount !== 1 ? 's' : ''} selected`;
        
        // Update process selected button
        this.processSelectedBtn.disabled = selectedCount === 0 || this.isProcessing || !this.ocrServiceAvailable;
        if (this.processSelectedBtn.disabled) {
            this.processSelectedBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            this.processSelectedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        
        // Update select all checkbox
        this.selectAllCheckbox.checked = selectedCount === totalCount && totalCount > 0;
        this.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
    }

    toggleSelectAll(checked) {
        this.selectedDocuments.clear();
        
        if (checked) {
            this.documents.forEach(doc => this.selectedDocuments.add(doc.id));
        }
        
        document.querySelectorAll('.document-checkbox').forEach(checkbox => {
            checkbox.checked = checked;
        });
        
        this.updateSelectionUI();
    }

    confirmProcessAll() {
        if (!this.ocrServiceAvailable) {
            this.showError('OCR service is not available');
            return;
        }
        
        const totalCount = this.documents.length;
        if (totalCount === 0) {
            this.showError('No documents available for processing');
            return;
        }
        
        this.showConfirmModal(
            `Process all ${totalCount} documents with OCR? This will replace the current document content.`,
            () => this.processAll()
        );
    }

    confirmProcessSelected() {
        if (!this.ocrServiceAvailable) {
            this.showError('OCR service is not available');
            return;
        }
        
        const selectedCount = this.selectedDocuments.size;
        if (selectedCount === 0) {
            this.showError('No documents selected for processing');
            return;
        }
        
        this.showConfirmModal(
            `Process ${selectedCount} selected document${selectedCount !== 1 ? 's' : ''} with OCR? This will replace the current document content.`,
            () => this.processSelected()
        );
    }

    async processAll() {
        const documentIds = this.documents.map(doc => doc.id);
        await this.startProcessing(documentIds);
    }

    async processSelected() {
        const documentIds = Array.from(this.selectedDocuments);
        await this.startProcessing(documentIds);
    }

    async startProcessing(documentIds) {
        if (this.isProcessing) return;
        
        try {
            this.setProcessingState(true);
            
            const response = await fetch('/api/ocr/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentIds })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addLogEntry(`Started processing ${documentIds.length} documents`, 'info');
                this.showToast('Processing started', 'success');
            } else {
                this.setProcessingState(false);
                this.showError('Failed to start processing: ' + data.error);
            }
        } catch (error) {
            this.setProcessingState(false);
            this.showError('Error starting processing: ' + error.message);
        }
    }

    async stopProcessing() {
        try {
            const response = await fetch('/api/ocr/stop', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                this.addLogEntry('Processing stopped by user', 'warning');
                this.showToast('Processing stopped', 'warning');
            } else {
                this.showError('Failed to stop processing: ' + data.error);
            }
        } catch (error) {
            this.showError('Error stopping processing: ' + error.message);
        }
    }

    setProcessingState(processing) {
        this.isProcessing = processing;
        
        // Update button states
        this.processAllBtn.disabled = processing || !this.ocrServiceAvailable;
        this.processSelectedBtn.disabled = processing || this.selectedDocuments.size === 0 || !this.ocrServiceAvailable;
        this.refreshBtn.disabled = processing;
        
        // Update button appearance
        [this.processAllBtn, this.processSelectedBtn, this.refreshBtn].forEach(btn => {
            if (btn.disabled) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
        
        // Update checkboxes
        document.querySelectorAll('.document-checkbox').forEach(checkbox => {
            checkbox.disabled = processing;
        });
        
        this.selectAllCheckbox.disabled = processing;
        
        // Show/hide status card
        if (processing) {
            this.statusCard.classList.remove('hidden');
        } else {
            this.statusCard.classList.add('hidden');
        }
    }

    async refreshData() {
        await Promise.all([
            this.loadDocuments(),
            this.checkOCRServiceHealth()
        ]);
        this.addLogEntry('Data refreshed', 'info');
    }

    initializeSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        this.eventSource = new EventSource('/api/ocr/events');
        
        this.eventSource.addEventListener('status', (event) => {
            const status = JSON.parse(event.data);
            this.updateStatus(status);
        });

        this.eventSource.addEventListener('processingStarted', (event) => {
            const data = JSON.parse(event.data);
            this.setProcessingState(true);
            
            let message = `Processing started: ${data.totalDocuments} documents`;
            if (data.skippedDocuments && data.skippedDocuments > 0) {
                message += ` (${data.skippedDocuments} already processed, skipped)`;
            }
            this.addLogEntry(message, 'info');
        });

        this.eventSource.addEventListener('documentStarted', (event) => {
            const data = JSON.parse(event.data);
            this.currentDoc.textContent = `Processing document ${data.documentId} (${data.documentIndex}/${data.totalDocuments})`;
            this.updateDocumentStatus(data.documentId, 'processing');
            this.addLogEntry(`Started processing document ${data.documentId}`, 'info');
        });

        this.eventSource.addEventListener('documentCompleted', (event) => {
            const data = JSON.parse(event.data);
            const status = data.success ? 'completed' : 'error';
            this.updateDocumentStatus(data.documentId, status);
            
            const logType = data.success ? 'success' : 'error';
            const message = data.success 
                ? `Document ${data.documentId} completed successfully ${data.textLength ? `(${data.textLength} characters)` : ''}`
                : `Document ${data.documentId} failed: ${data.error}`;
            
            this.addLogEntry(message, logType);
            
            // Update progress
            this.updateProgress(data.progress, data.processedDocuments, data.totalDocuments);
        });

        this.eventSource.addEventListener('processingCompleted', (event) => {
            const data = JSON.parse(event.data);
            this.setProcessingState(false);
            
            const message = `Processing completed: ${data.successfulDocuments}/${data.totalDocuments} documents successful`;
            this.addLogEntry(message, 'success');
            
            const duration = Math.round(data.duration / 1000);
            this.addLogEntry(`Total processing time: ${duration} seconds`, 'info');
            
            this.showToast('Processing completed', 'success');
        });

        this.eventSource.addEventListener('processingStopped', (event) => {
            const data = JSON.parse(event.data);
            this.setProcessingState(false);
            this.addLogEntry(`Processing stopped: ${data.processedDocuments}/${data.totalDocuments} documents processed`, 'warning');
        });

        this.eventSource.addEventListener('processingError', (event) => {
            const data = JSON.parse(event.data);
            this.setProcessingState(false);
            this.addLogEntry(`Processing error: ${data.error}`, 'error');
            this.showError('Processing error: ' + data.error);
        });

        this.eventSource.addEventListener('heartbeat', (event) => {
            // Keep connection alive
        });

        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            this.addLogEntry('Connection to server lost, retrying...', 'warning');
            
            // Retry connection after 5 seconds
            setTimeout(() => {
                this.initializeSSE();
            }, 5000);
        };
    }

    updateStatus(status) {
        if (status.isProcessing) {
            this.setProcessingState(true);
            this.updateProgress(status.progress, status.processedDocuments, status.totalDocuments);
            
            if (status.currentProcessing) {
                this.currentDoc.textContent = `Processing document ${status.currentProcessing.documentId} (${status.currentProcessing.index}/${status.currentProcessing.total})`;
            }
            
            // Update estimated completion time
            if (status.estimatedCompletion) {
                const eta = new Date(status.estimatedCompletion);
                this.estimatedTime.textContent = `ETA: ${eta.toLocaleTimeString()}`;
            }
        } else {
            this.setProcessingState(false);
        }
    }

    updateProgress(progress, processed, total) {
        this.progressBar.style.width = `${progress}%`;
        this.progressBadge.textContent = `${processed}/${total}`;
    }

    updateDocumentStatus(documentId, status) {
        const statusElement = document.querySelector(`[data-doc-id="${documentId}"].document-status`);
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            const text = statusElement.querySelector('span');
            
            // Remove all status classes
            statusElement.classList.remove('status-ready', 'status-processing', 'status-completed', 'status-error');
            
            switch (status) {
                case 'processing':
                    statusElement.classList.add('status-processing');
                    icon.className = 'fas fa-spinner fa-spin text-xs';
                    text.textContent = 'Processing';
                    break;
                case 'completed':
                    statusElement.classList.add('status-completed');
                    icon.className = 'fas fa-check-circle text-xs';
                    text.textContent = 'Completed';
                    break;
                case 'error':
                    statusElement.classList.add('status-error');
                    icon.className = 'fas fa-exclamation-triangle text-xs';
                    text.textContent = 'Error';
                    break;
                default:
                    statusElement.classList.add('status-ready');
                    icon.className = 'fas fa-circle text-xs';
                    text.textContent = 'Ready';
            }
        }
    }

    addLogEntry(message, type) {
        const timestamp = new Date().toLocaleTimeString();
        const entry = {
            timestamp,
            message,
            type,
            id: Date.now()
        };
        
        this.logEntries.push(entry);
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `
            <span class="text-gray-500">[${timestamp}]</span>
            <i class="fas ${this.getLogIcon(type)} mr-1"></i>
            <span>${message}</span>
        `;
        
        this.processingLog.appendChild(logEntry);
        
        if (this.autoScroll) {
            this.processingLog.scrollTop = this.processingLog.scrollHeight;
        }
    }

    getLogIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-triangle';
            case 'warning': return 'fa-exclamation-circle';
            default: return 'fa-info-circle';
        }
    }

    clearLog() {
        this.logEntries = [];
        this.processingLog.innerHTML = `
            <div class="log-entry text-gray-500">
                <i class="fas fa-info-circle"></i>
                Processing log cleared...
            </div>
        `;
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        const btn = this.autoScrollBtn;
        const icon = btn.querySelector('i');
        
        if (this.autoScroll) {
            btn.classList.add('bg-blue-100', 'text-blue-600');
            btn.classList.remove('bg-gray-100', 'text-gray-600');
            icon.classList.add('fa-arrow-down');
            icon.classList.remove('fa-arrow-up');
            this.processingLog.scrollTop = this.processingLog.scrollHeight;
        } else {
            btn.classList.remove('bg-blue-100', 'text-blue-600');
            btn.classList.add('bg-gray-100', 'text-gray-600');
            icon.classList.remove('fa-arrow-down');
            icon.classList.add('fa-arrow-up');
        }
    }

    downloadLog() {
        const logText = this.logEntries
            .map(entry => `[${entry.timestamp}] ${entry.message}`)
            .join('\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ocr-processing-log-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showConfirmModal(message, callback) {
        this.confirmMessage.textContent = message;
        this.confirmAction = callback;
        this.confirmModal.classList.remove('hidden');
    }

    hideConfirmModal() {
        this.confirmModal.classList.add('hidden');
        this.confirmAction = null;
    }

    executeConfirmedAction() {
        if (this.confirmAction) {
            this.confirmAction();
        }
        this.hideConfirmModal();
    }

    showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `
            flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-white
            ${type === 'success' ? 'bg-green-500' : 
              type === 'error' ? 'bg-red-500' : 
              type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}
        `;
        
        toast.innerHTML = `
            <i class="fas ${this.getLogIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        this.toastContainer.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showError(message) {
        this.showToast(message, 'error');
        this.addLogEntry(message, 'error');
    }

    confirmResetDocument(documentId) {
        const document = this.documents.find(doc => doc.id === documentId);
        const title = document ? document.title : `Document ${documentId}`;
        
        this.showConfirmModal(
            `Reset processing status for "${title}"? This will allow the document to be processed again.`,
            () => this.resetDocument(documentId)
        );
    }

    confirmResetAll() {
        this.showConfirmModal(
            'Reset all processing history? This will clear all OCR processing records and allow all documents to be processed again. This action cannot be undone.',
            () => this.resetAllProcessing()
        );
    }

    async resetDocument(documentId) {
        try {
            const response = await fetch(`/api/ocr/processed/${documentId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addLogEntry(`Reset processing status for document ${documentId}`, 'info');
                this.showToast('Document reset successfully', 'success');
                await this.loadDocuments(); // Reload to update UI
            } else {
                this.showError('Failed to reset document: ' + data.error);
            }
        } catch (error) {
            this.showError('Error resetting document: ' + error.message);
        }
    }

    async resetAllProcessing() {
        try {
            const response = await fetch('/api/ocr/processed', {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addLogEntry('Reset all processing history', 'warning');
                this.showToast('All processing history reset', 'success');
                await this.loadDocuments(); // Reload to update UI
            } else {
                this.showError('Failed to reset all processing history: ' + data.error);
            }
        } catch (error) {
            this.showError('Error resetting all processing history: ' + error.message);
        }
    }
}

// Theme Manager
class ThemeManager {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.initialize();
    }

    initialize() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const icon = this.themeToggle.querySelector('i');
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
    new OCRManager();
});