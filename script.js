// Main Cheque Manager Class
class ChequeManager {
    constructor() {
        this.cheques = JSON.parse(localStorage.getItem('cheques')) || [];
        this.settings = JSON.parse(localStorage.getItem('chequeSettings')) || this.getDefaultSettings();
        this.currentImage = null;
        this.currentCameraStream = null;
        this.tesseractWorker = null;
        this.currentTab = 'dashboard';
        this.filteredCheques = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedCheques = new Set(); // For deposit slip
        this.currentFilter = 'all';
        this.customRange = null;
        
        this.init();
    }
    
    getDefaultSettings() {
        return {
            accountHolder: 'Your Name',
            defaultBank: 'Your Bank',
            currency: 'LKR',
            dateFormat: 'dd/mm/yyyy',
            ocrLanguage: 'eng',
            autoExtract: true,
            saveImages: true,
            depositNotes: 'All cheques are properly endorsed',
            preparedBy: 'Admin'
        };
    }
    
    init() {
        // Set current date
        this.setCurrentDate();
        
        // Initialize dashboard
        this.updateDashboard();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data
        this.loadChequeList();
        this.updateDepositPreview();
        
        // Initialize Tesseract.js worker
        this.initializeTesseract();
    }
    
    setCurrentDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
        
        // Set default dates in forms
        const today = now.toISOString().split('T')[0];
        document.getElementById('dateIssued').value = today;
        document.getElementById('dateDeposited').value = today;
        document.getElementById('depositDate').value = today;
    }
    
    async initializeTesseract() {
        try {
            this.tesseractWorker = await Tesseract.createWorker(this.settings.ocrLanguage);
            console.log('Tesseract.js worker initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Tesseract.js:', error);
            this.showNotification('OCR engine failed to initialize. Manual entry only.', 'error');
        }
    }
    
    setupEventListeners() {
        // File upload
        const imageUpload = document.getElementById('imageUpload');
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('click', () => imageUpload.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#3498db';
            uploadArea.style.background = '#f8f9fa';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#dee2e6';
            uploadArea.style.background = 'white';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#dee2e6';
            uploadArea.style.background = 'white';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleImageUpload(file);
            }
        });
        
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageUpload(file);
            }
        });
        
        // Camera button
        document.getElementById('captureBtn').addEventListener('click', () => {
            this.openCamera();
        });
        
        // Extract data button
        document.getElementById('extractBtn').addEventListener('click', () => {
            this.extractDataFromImage();
        });
        
        // Time period filter
        document.getElementById('timePeriod').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            if (e.target.value === 'custom') {
                document.getElementById('customRange').style.display = 'flex';
            } else {
                document.getElementById('customRange').style.display = 'none';
                this.customRange = null;
                this.updateDashboard();
            }
        });
        
        // File input for Excel update
        document.getElementById('updateFile').addEventListener('change', (e) => {
            this.updateExistingExcel(e.target.files[0]);
        });
        
        // File input for Excel import
        document.getElementById('importFile').addEventListener('change', (e) => {
            this.importFromExcel(e.target.files[0]);
        });
    }
    
    // Tab Navigation
    switchTab(tabId) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Activate selected tab
        document.querySelector(`[onclick="chequeManager.switchTab('${tabId}')"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        this.currentTab = tabId;
        
        // Refresh tab-specific content
        if (tabId === 'cheque-list') {
            this.loadChequeList();
        } else if (tabId === 'deposit-slip') {
            this.updateDepositSelection();
        } else if (tabId === 'dashboard') {
            this.updateDashboard();
        }
    }
    
    // Dashboard Functions
    updateDashboard() {
        let filteredCheques = [...this.cheques];
        let periodLabel = 'All Time';
        let rangeStart = 'N/A';
        let rangeEnd = 'N/A';
        let daysInPeriod = 0;
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (this.currentFilter) {
            case 'today':
                filteredCheques = this.cheques.filter(cheque => {
                    const chequeDate = new Date(cheque.dateIssued);
                    return chequeDate.toDateString() === today.toDateString();
                });
                periodLabel = 'Today';
                rangeStart = today.toLocaleDateString();
                rangeEnd = today.toLocaleDateString();
                daysInPeriod = 1;
                break;
                
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                filteredCheques = this.cheques.filter(cheque => {
                    const chequeDate = new Date(cheque.dateIssued);
                    return chequeDate.toDateString() === yesterday.toDateString();
                });
                periodLabel = 'Yesterday';
                rangeStart = yesterday.toLocaleDateString();
                rangeEnd = yesterday.toLocaleDateString();
                daysInPeriod = 1;
                break;
                
            case 'week':
                const weekStart = new Date(today);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                filteredCheques = this.cheques.filter(cheque => {
                    const chequeDate = new Date(cheque.dateIssued);
                    return chequeDate >= weekStart && chequeDate <= today;
                });
                periodLabel = 'This Week';
                rangeStart = weekStart.toLocaleDateString();
                rangeEnd = today.toLocaleDateString();
                daysInPeriod = 7;
                break;
                
            case 'month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                filteredCheques = this.cheques.filter(cheque => {
                    const chequeDate = new Date(cheque.dateIssued);
                    return chequeDate >= monthStart && chequeDate <= today;
                });
                periodLabel = 'This Month';
                rangeStart = monthStart.toLocaleDateString();
                rangeEnd = today.toLocaleDateString();
                daysInPeriod = today.getDate();
                break;
                
            case 'year':
                const yearStart = new Date(today.getFullYear(), 0, 1);
                filteredCheques = this.cheques.filter(cheque => {
                    const chequeDate = new Date(cheque.dateIssued);
                    return chequeDate >= yearStart && chequeDate <= today;
                });
                periodLabel = 'This Year';
                rangeStart = yearStart.toLocaleDateString();
                rangeEnd = today.toLocaleDateString();
                daysInPeriod = Math.floor((today - yearStart) / (1000 * 60 * 60 * 24)) + 1;
                break;
                
            case 'custom':
                if (this.customRange) {
                    filteredCheques = this.cheques.filter(cheque => {
                        const chequeDate = new Date(cheque.dateIssued);
                        return chequeDate >= this.customRange.start && chequeDate <= this.customRange.end;
                    });
                    periodLabel = 'Custom Range';
                    rangeStart = this.customRange.start.toLocaleDateString();
                    rangeEnd = this.customRange.end.toLocaleDateString();
                    daysInPeriod = Math.floor((this.customRange.end - this.customRange.start) / (1000 * 60 * 60 * 24)) + 1;
                }
                break;
        }
        
        // Update period label
        document.getElementById('periodSummary').innerHTML = 
            `Showing data for: <strong>${periodLabel}</strong>`;
        
        // Calculate statistics
        const totalAmount = filteredCheques.reduce((sum, cheque) => sum + parseFloat(cheque.amount || 0), 0);
        const chequeCount = filteredCheques.length;
        const pendingCheques = filteredCheques.filter(c => c.status === 'pending').length;
        const processedCheques = filteredCheques.filter(c => c.status === 'processed').length;
        const depositedCheques = filteredCheques.filter(c => c.status === 'deposited').length;
        const bankCount = new Set(filteredCheques.map(c => c.bankName)).size;
        const avgAmount = chequeCount > 0 ? totalAmount / chequeCount : 0;
        const maxAmount = filteredCheques.length > 0 ? 
            Math.max(...filteredCheques.map(c => parseFloat(c.amount || 0))) : 0;
        const minAmount = filteredCheques.length > 0 ? 
            Math.min(...filteredCheques.map(c => parseFloat(c.amount || 0))) : 0;
        
        // Update dashboard stats
        document.getElementById('totalAmount').textContent = this.formatCurrency(totalAmount);
        document.getElementById('chequeCount').textContent = chequeCount;
        document.getElementById('pendingCheques').textContent = pendingCheques;
        document.getElementById('bankCount').textContent = bankCount;
        document.getElementById('avgAmount').textContent = this.formatCurrency(avgAmount);
        document.getElementById('maxAmount').textContent = this.formatCurrency(maxAmount);
        document.getElementById('minAmount').textContent = this.formatCurrency(minAmount);
        document.getElementById('processedCount').textContent = processedCheques;
        document.getElementById('depositedCount').textContent = depositedCheques;
        
        // Update date range details
        document.getElementById('rangeStart').textContent = rangeStart;
        document.getElementById('rangeEnd').textContent = rangeEnd;
        document.getElementById('daysInPeriod').textContent = daysInPeriod;
        document.getElementById('chequesPerDay').textContent = daysInPeriod > 0 ? (chequeCount / daysInPeriod).toFixed(1) : '0.0';
        document.getElementById('amountPerDay').textContent = daysInPeriod > 0 ? 
            this.formatCurrency(totalAmount / daysInPeriod) : this.formatCurrency(0);
    }
    
    applyCustomRange() {
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        
        if (!fromDate || !toDate) {
            this.showNotification('Please select both start and end dates', 'error');
            return;
        }
        
        const start = new Date(fromDate);
        const end = new Date(toDate);
        
        if (start > end) {
            this.showNotification('Start date must be before end date', 'error');
            return;
        }
        
        this.customRange = { start, end };
        this.updateDashboard();
    }
    
    // Image Processing Functions
    handleImageUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            this.displayImagePreview(this.currentImage);
            
            // Auto-extract if enabled
            if (this.settings.autoExtract && this.tesseractWorker) {
                setTimeout(() => this.extractDataFromImage(), 500);
            }
        };
        reader.readAsDataURL(file);
    }
    
    displayImagePreview(imageSrc) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${imageSrc}" alt="Cheque Preview">`;
        document.getElementById('extractBtn').disabled = false;
    }
    
    async extractDataFromImage() {
        if (!this.currentImage) {
            this.showNotification('Please upload an image first', 'error');
            return;
        }
        
        if (!this.tesseractWorker) {
            this.showNotification('OCR engine not available. Please enter data manually.', 'error');
            return;
        }
        
        const statusDiv = document.getElementById('ocrStatus');
        statusDiv.className = 'ocr-status extracting';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting text from image...';
        
        try {
            const result = await this.tesseractWorker.recognize(this.currentImage);
            
            statusDiv.className = 'ocr-status success';
            statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Text extracted successfully!';
            
            // Parse extracted text
            this.parseExtractedText(result.data.text);
            
        } catch (error) {
            console.error('OCR Error:', error);
            statusDiv.className = 'ocr-status error';
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to extract text. Please enter manually.';
        }
    }
    
    parseExtractedText(text) {
        console.log('OCR Text:', text);
        
        // Simple parsing logic - you can enhance this based on your cheque format
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 2);
        
        let chequeNo = '';
        let amount = '';
        let bankName = '';
        let payee = '';
        let date = '';
        
        // Look for common patterns
        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            
            // Look for cheque number (typically contains digits)
            if (!chequeNo && line.match(/cheque.*?(\d+)/i)) {
                chequeNo = line.match(/cheque.*?(\d+)/i)[1];
            } else if (!chequeNo && line.match(/\b\d{6,}\b/)) {
                chequeNo = line.match(/\b\d{6,}\b/)[0];
            }
            
            // Look for amount (LKR or Rs)
            if (!amount) {
                const amountMatch = line.match(/(?:Rs\.?|LKR|රු)\s*([\d,]+(?:\.\d{2})?)/i) || 
                                   line.match(/([\d,]+(?:\.\d{2})?)\s*(?:Rs|LKR|රු)/i);
                if (amountMatch) {
                    amount = amountMatch[1].replace(/,/g, '');
                } else if (line.match(/[\d,]+\.\d{2}/)) {
                    amount = line.match(/[\d,]+\.\d{2}/)[0].replace(/,/g, '');
                }
            }
            
            // Look for bank names (common Sri Lankan banks)
            const banks = [
                'Commercial Bank', 'Bank of Ceylon', "People's Bank", 
                'Hatton National Bank', 'Sampath Bank', 'Seylan Bank',
                'NDB Bank', 'DFCC Bank', 'Pan Asia Bank', 'HSBC',
                'Standard Chartered', 'Citibank', 'Habib Bank'
            ];
            
            if (!bankName) {
                for (const bank of banks) {
                    if (lowerLine.includes(bank.toLowerCase())) {
                        bankName = bank;
                        break;
                    }
                }
            }
            
            // Look for date (common formats)
            if (!date && line.match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/)) {
                date = line.match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/)[0];
            }
            
            // Look for payee (lines that look like names)
            if (!payee && line.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/)) {
                payee = line;
            }
        });
        
        // Fill form fields with extracted data
        if (chequeNo) document.getElementById('chequeNo').value = chequeNo;
        if (amount) document.getElementById('amount').value = amount;
        if (bankName) document.getElementById('bankName').value = bankName;
        if (payee) document.getElementById('payee').value = payee;
        if (date) {
            // Try to parse and format the date
            try {
                const parsedDate = new Date(date.replace(/(\d+)[-\/](\d+)[-\/](\d+)/, '$2/$1/$3'));
                if (!isNaN(parsedDate.getTime())) {
                    document.getElementById('dateIssued').value = parsedDate.toISOString().split('T')[0];
                }
            } catch (e) {
                console.log('Date parsing error:', e);
            }
        }
    }
    
    // Camera Functions
    async openCamera() {
        const modal = document.getElementById('cameraModal');
        modal.classList.add('active');
        
        try {
            const constraints = { 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentCameraStream = stream;
            const video = document.getElementById('cameraPreview');
            video.srcObject = stream;
            
        } catch (error) {
            console.error('Camera error:', error);
            this.showNotification('Unable to access camera. Please check permissions.', 'error');
            this.closeCamera();
        }
    }
    
    capturePhoto() {
        const video = document.getElementById('cameraPreview');
        const canvas = document.getElementById('photoCanvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        this.currentImage = canvas.toDataURL('image/jpeg');
        this.displayImagePreview(this.currentImage);
        this.closeCamera();
        
        // Auto-extract if enabled
        if (this.settings.autoExtract && this.tesseractWorker) {
            setTimeout(() => this.extractDataFromImage(), 500);
        }
    }
    
    async switchCamera() {
        if (!this.currentCameraStream) return;
        
        const video = document.getElementById('cameraPreview');
        const currentFacingMode = video.srcObject.getVideoTracks()[0].getSettings().facingMode;
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        // Stop current stream
        this.currentCameraStream.getTracks().forEach(track => track.stop());
        
        try {
            const constraints = { 
                video: { 
                    facingMode: newFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentCameraStream = stream;
            video.srcObject = stream;
        } catch (error) {
            console.error('Camera switch error:', error);
            this.showNotification('Error switching camera', 'error');
        }
    }
    
    closeCamera() {
        const modal = document.getElementById('cameraModal');
        modal.classList.remove('active');
        
        if (this.currentCameraStream) {
            this.currentCameraStream.getTracks().forEach(track => track.stop());
            this.currentCameraStream = null;
        }
    }
    
    // Cheque Management Functions
    saveCheque() {
        // Get form values
        const cheque = {
            id: Date.now().toString(),
            chequeNo: document.getElementById('chequeNo').value.trim(),
            amount: parseFloat(document.getElementById('amount').value) || 0,
            bankName: document.getElementById('bankName').value.trim(),
            branch: document.getElementById('branch').value.trim(),
            payee: document.getElementById('payee').value.trim(),
            accountNo: document.getElementById('accountNo').value.trim(),
            dateIssued: document.getElementById('dateIssued').value,
            dateDeposited: document.getElementById('dateDeposited').value,
            notes: document.getElementById('notes').value.trim(),
            status: document.getElementById('status').value,
            image: this.settings.saveImages ? this.currentImage : null,
            createdAt: new Date().toISOString()
        };
        
        // Validate required fields
        if (!cheque.chequeNo || !cheque.amount || !cheque.bankName || !cheque.payee) {
            this.showNotification('Please fill all required fields', 'error');
            return;
        }
        
        // Check for duplicate cheque number
        const existingIndex = this.cheques.findIndex(c => c.chequeNo === cheque.chequeNo);
        if (existingIndex !== -1) {
            if (!confirm(`Cheque number ${cheque.chequeNo} already exists. Update existing cheque?`)) {
                return;
            }
            this.cheques[existingIndex] = cheque;
        } else {
            this.cheques.unshift(cheque); // Add to beginning
        }
        
        // Save to localStorage
        this.saveToStorage();
        
        // Update UI
        this.loadChequeList();
        this.updateDashboard();
        this.updateDepositSelection();
        
        // Clear form
        this.clearForm();
        
        this.showNotification('Cheque saved successfully!', 'success');
    }
    
    saveAndNew() {
        this.saveCheque();
        // Form will be cleared by saveCheque
    }
    
    clearForm() {
        document.getElementById('chequeForm').reset();
        document.getElementById('imagePreview').innerHTML = 
            '<div class="empty-preview"><i class="fas fa-image"></i><p>No image selected</p></div>';
        document.getElementById('extractBtn').disabled = true;
        document.getElementById('ocrStatus').innerHTML = '';
        this.currentImage = null;
        this.setCurrentDate(); // Reset dates to today
    }
    
    clearImage() {
        document.getElementById('imagePreview').innerHTML = 
            '<div class="empty-preview"><i class="fas fa-image"></i><p>No image selected</p></div>';
        document.getElementById('extractBtn').disabled = true;
        document.getElementById('ocrStatus').innerHTML = '';
        this.currentImage = null;
    }
    
    // Cheque List Functions
    loadChequeList() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;
        
        // Filter cheques
        this.filteredCheques = this.cheques.filter(cheque => {
            // Search filter
            const matchesSearch = !searchTerm || 
                cheque.chequeNo.toLowerCase().includes(searchTerm) ||
                cheque.payee.toLowerCase().includes(searchTerm) ||
                cheque.bankName.toLowerCase().includes(searchTerm);
            
            // Status filter
            const matchesStatus = statusFilter === 'all' || cheque.status === statusFilter;
            
            // Date filter
            const matchesDate = !dateFilter || cheque.dateIssued === dateFilter;
            
            return matchesSearch && matchesStatus && matchesDate;
        });
        
        // Update summary
        const totalAmount = this.filteredCheques.reduce((sum, cheque) => sum + parseFloat(cheque.amount || 0), 0);
        document.getElementById('showingCount').textContent = this.filteredCheques.length;
        document.getElementById('listTotalAmount').textContent = this.formatCurrency(totalAmount);
        
        // Paginate
        this.renderChequeTable();
        this.updatePagination();
    }
    
    renderChequeTable() {
        const tbody = document.getElementById('chequeTableBody');
        tbody.innerHTML = '';
        
        if (this.filteredCheques.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-inbox" style="font-size: 2rem; color: #95a5a6; margin-bottom: 1rem;"></i>
                        <p>No cheques found</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageCheques = this.filteredCheques.slice(startIndex, endIndex);
        
        pageCheques.forEach(cheque => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cheque.chequeNo}</td>
                <td>${cheque.payee}</td>
                <td>${cheque.bankName}</td>
                <td>${this.formatCurrency(cheque.amount)}</td>
                <td>${this.formatDate(cheque.dateIssued)}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td>
                    <button class="btn small" onclick="chequeManager.viewCheque('${cheque.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn small secondary" onclick="chequeManager.editCheque('${cheque.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn small danger" onclick="chequeManager.deleteCheque('${cheque.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.filteredCheques.length / this.itemsPerPage);
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const pageInfo = document.getElementById('pageInfo');
        
        pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
    }
    
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderChequeTable();
            this.updatePagination();
        }
    }
    
    nextPage() {
        const totalPages = Math.ceil(this.filteredCheques.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderChequeTable();
            this.updatePagination();
        }
    }
    
    searchCheques() {
        this.currentPage = 1;
        this.loadChequeList();
    }
    
    filterCheques() {
        this.currentPage = 1;
        this.loadChequeList();
    }
    
    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('dateFilter').value = '';
        this.currentPage = 1;
        this.loadChequeList();
    }
    
    viewCheque(id) {
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) return;
        
        let modalContent = `
            <div class="cheque-details">
                <div class="detail-row">
                    <strong>Cheque Number:</strong> ${cheque.chequeNo}
                </div>
                <div class="detail-row">
                    <strong>Amount:</strong> ${this.formatCurrency(cheque.amount)}
                </div>
                <div class="detail-row">
                    <strong>Bank:</strong> ${cheque.bankName}
                </div>
                <div class="detail-row">
                    <strong>Branch:</strong> ${cheque.branch || 'N/A'}
                </div>
                <div class="detail-row">
                    <strong>Payee:</strong> ${cheque.payee}
                </div>
                <div class="detail-row">
                    <strong>Account Number:</strong> ${cheque.accountNo || 'N/A'}
                </div>
                <div class="detail-row">
                    <strong>Date Issued:</strong> ${this.formatDate(cheque.dateIssued)}
                </div>
                <div class="detail-row">
                    <strong>Date to Deposit:</strong> ${this.formatDate(cheque.dateDeposited)}
                </div>
                <div class="detail-row">
                    <strong>Status:</strong> <span class="status-badge status-${cheque.status}">${cheque.status}</span>
                </div>
                <div class="detail-row">
                    <strong>Notes:</strong> ${cheque.notes || 'None'}
                </div>
        `;
        
        if (cheque.image) {
            modalContent += `
                <div class="detail-row">
                    <strong>Cheque Image:</strong><br>
                    <img src="${cheque.image}" style="max-width: 100%; max-height: 300px; margin-top: 1rem; border: 1px solid #ddd;">
                </div>
            `;
        }
        
        modalContent += `</div>`;
        
        document.getElementById('editModalBody').innerHTML = modalContent;
        document.getElementById('editModal').classList.add('active');
    }
    
    editCheque(id) {
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) return;
        
        const modalContent = `
            <form id="editChequeForm" onsubmit="event.preventDefault(); chequeManager.updateCheque('${cheque.id}');">
                <input type="hidden" id="editId" value="${cheque.id}">
                <div class="form-row">
                    <div class="form-group">
                        <label>Cheque Number *</label>
                        <input type="text" id="editChequeNo" value="${cheque.chequeNo}" required>
                    </div>
                    <div class="form-group">
                        <label>Amount (LKR) *</label>
                        <input type="number" id="editAmount" value="${cheque.amount}" step="0.01" min="0" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Bank Name *</label>
                        <input type="text" id="editBankName" value="${cheque.bankName}" required>
                    </div>
                    <div class="form-group">
                        <label>Branch</label>
                        <input type="text" id="editBranch" value="${cheque.branch || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Payee Name *</label>
                        <input type="text" id="editPayee" value="${cheque.payee}" required>
                    </div>
                    <div class="form-group">
                        <label>Account Number</label>
                        <input type="text" id="editAccountNo" value="${cheque.accountNo || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Date Issued *</label>
                        <input type="date" id="editDateIssued" value="${cheque.dateIssued}" required>
                    </div>
                    <div class="form-group">
                        <label>Date to Deposit *</label>
                        <input type="date" id="editDateDeposited" value="${cheque.dateDeposited}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="editStatus">
                        <option value="pending" ${cheque.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="processed" ${cheque.status === 'processed' ? 'selected' : ''}>Processed</option>
                        <option value="deposited" ${cheque.status === 'deposited' ? 'selected' : ''}>Deposited</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="editNotes" rows="3">${cheque.notes || ''}</textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn secondary" onclick="chequeManager.closeEditModal()">Cancel</button>
                    <button type="submit" class="btn primary">Save Changes</button>
                </div>
            </form>
        `;
        
        document.getElementById('editModalBody').innerHTML = modalContent;
        document.getElementById('editModal').classList.add('active');
    }
    
    updateCheque(id) {
        const index = this.cheques.findIndex(c => c.id === id);
        if (index === -1) return;
        
        this.cheques[index] = {
            ...this.cheques[index],
            chequeNo: document.getElementById('editChequeNo').value.trim(),
            amount: parseFloat(document.getElementById('editAmount').value) || 0,
            bankName: document.getElementById('editBankName').value.trim(),
            branch: document.getElementById('editBranch').value.trim(),
            payee: document.getElementById('editPayee').value.trim(),
            accountNo: document.getElementById('editAccountNo').value.trim(),
            dateIssued: document.getElementById('editDateIssued').value,
            dateDeposited: document.getElementById('editDateDeposited').value,
            status: document.getElementById('editStatus').value,
            notes: document.getElementById('editNotes').value.trim()
        };
        
        this.saveToStorage();
        this.loadChequeList();
        this.updateDashboard();
        this.updateDepositSelection();
        this.closeEditModal();
        
        this.showNotification('Cheque updated successfully!', 'success');
    }
    
    deleteCheque(id) {
        if (!confirm('Are you sure you want to delete this cheque? This action cannot be undone.')) {
            return;
        }
        
        this.cheques = this.cheques.filter(c => c.id !== id);
        this.saveToStorage();
        this.loadChequeList();
        this.updateDashboard();
        this.updateDepositSelection();
        
        this.showNotification('Cheque deleted successfully!', 'success');
    }
    
    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
    }
    
    // Deposit Slip Functions
    updateDepositSelection() {
        const pendingCheques = this.cheques.filter(c => c.status === 'pending');
        const container = document.getElementById('depositChequeList');
        
        if (pendingCheques.length === 0) {
            container.innerHTML = `
                <div class="empty-selection">
                    <i class="fas fa-file-invoice-dollar"></i>
                    <p>No pending cheques available</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        pendingCheques.forEach(cheque => {
            const isSelected = this.selectedCheques.has(cheque.id);
            html += `
                <div class="cheque-select-card ${isSelected ? 'selected' : ''}" 
                     onclick="chequeManager.toggleChequeSelection('${cheque.id}')">
                    <div class="cheque-card-header">
                        <h4>${cheque.chequeNo}</h4>
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onclick="event.stopPropagation(); chequeManager.toggleChequeSelection('${cheque.id}')">
                    </div>
                    <div class="cheque-card-body">
                        <p><strong>Payee:</strong> ${cheque.payee}</p>
                        <p><strong>Bank:</strong> ${cheque.bankName}</p>
                        <p><strong>Amount:</strong> ${this.formatCurrency(cheque.amount)}</p>
                        <p><strong>Date:</strong> ${this.formatDate(cheque.dateIssued)}</p>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        this.updateDepositSummary();
        this.updateDepositPreview();
    }
    
    toggleChequeSelection(id) {
        if (this.selectedCheques.has(id)) {
            this.selectedCheques.delete(id);
        } else {
            this.selectedCheques.add(id);
        }
        this.updateDepositSelection();
    }
    
    selectAllForDeposit() {
        const pendingCheques = this.cheques.filter(c => c.status === 'pending');
        this.selectedCheques = new Set(pendingCheques.map(c => c.id));
        this.updateDepositSelection();
    }
    
    clearDepositSelection() {
        this.selectedCheques.clear();
        this.updateDepositSelection();
    }
    
    updateDepositSummary() {
        const selectedCheques = this.cheques.filter(c => this.selectedCheques.has(c.id));
        const totalAmount = selectedCheques.reduce((sum, cheque) => sum + parseFloat(cheque.amount || 0), 0);
        
        document.getElementById('selectedCount').textContent = selectedCheques.length;
        document.getElementById('selectedTotal').textContent = this.formatCurrency(totalAmount);
    }
    
    updateDepositPreview() {
        const selectedCheques = this.cheques.filter(c => this.selectedCheques.has(c.id));
        const totalAmount = selectedCheques.reduce((sum, cheque) => sum + parseFloat(cheque.amount || 0), 0);
        
        // Update slip date
        const depositDate = document.getElementById('depositDate').value || new Date().toISOString().split('T')[0];
        document.getElementById('slipDate').textContent = this.formatDate(depositDate);
        
        // Update account info from settings
        document.getElementById('accountHolder').textContent = this.settings.accountHolder;
        document.getElementById('accountNumber').textContent = this.settings.defaultAccount || 'XXXX-XXXX-XXXX';
        document.getElementById('bankNameSlip').textContent = this.settings.defaultBank;
        document.getElementById('branchSlip').textContent = this.settings.defaultBranch || 'Main Branch';
        document.getElementById('preparedBy').textContent = this.settings.preparedBy;
        document.getElementById('slipNotes').textContent = this.settings.depositNotes;
        
        // Update table
        const tbody = document.getElementById('depositTableBody');
        
        if (selectedCheques.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-table">
                        <i class="fas fa-file-invoice"></i>
                        <p>No cheques selected for deposit</p>
                    </td>
                </tr>
            `;
        } else {
            let html = '';
            selectedCheques.forEach((cheque, index) => {
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${cheque.chequeNo}</td>
                        <td>${cheque.bankName}</td>
                        <td>${cheque.payee}</td>
                        <td>${this.formatCurrency(cheque.amount)}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
        
        // Update total
        document.getElementById('depositTotal').textContent = this.formatCurrency(totalAmount);
        
        // Update amount in words
        document.getElementById('amountInWords').textContent = this.amountToWords(totalAmount);
    }
    
    generateDepositFromPending() {
        this.selectAllForDeposit();
        this.showNotification('All pending cheques selected for deposit', 'success');
    }
    
    markAsDeposited() {
        const selectedCheques = this.cheques.filter(c => this.selectedCheques.has(c.id));
        
        if (selectedCheques.length === 0) {
            this.showNotification('No cheques selected', 'warning');
            return;
        }
        
        if (!confirm(`Mark ${selectedCheques.length} cheque(s) as deposited?`)) {
            return;
        }
        
        selectedCheques.forEach(cheque => {
            cheque.status = 'deposited';
        });
        
        this.saveToStorage();
        this.selectedCheques.clear();
        this.updateDepositSelection();
        this.loadChequeList();
        this.updateDashboard();
        
        this.showNotification(`${selectedCheques.length} cheque(s) marked as deposited`, 'success');
    }
    
    printDepositSlip() {
        window.print();
    }
    
    saveDepositAsPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Get slip content
        const slipContent = document.querySelector('.deposit-slip');
        
        // Simple PDF generation (you can enhance this)
        doc.setFontSize(16);
        doc.text("BANK DEPOSIT SLIP", 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Date: ${document.getElementById('slipDate').textContent}`, 20, 40);
        
        // Add account info
        doc.text(`Account Holder: ${this.settings.accountHolder}`, 20, 50);
        doc.text(`Account Number: ${this.settings.defaultAccount || 'XXXX-XXXX-XXXX'}`, 20, 60);
        doc.text(`Bank: ${this.settings.defaultBank}`, 20, 70);
        
        // Add table
        const selectedCheques = this.cheques.filter(c => this.selectedCheques.has(c.id));
        let y = 90;
        
        selectedCheques.forEach((cheque, index) => {
            doc.text(`${index + 1}. ${cheque.chequeNo} - ${cheque.payee} - ${this.formatCurrency(cheque.amount)}`, 20, y);
            y += 10;
        });
        
        // Add total
        y += 10;
        doc.setFontSize(12);
        doc.text(`Total: ${document.getElementById('depositTotal').textContent}`, 20, y);
        
        // Add notes
        y += 20;
        doc.setFontSize(10);
        doc.text(`Notes: ${this.settings.depositNotes}`, 20, y);
        
        // Save PDF
        doc.save(`deposit-slip-${new Date().toISOString().split('T')[0]}.pdf`);
        
        this.showNotification('Deposit slip saved as PDF', 'success');
    }
    
    // Excel Functions
    exportToExcel() {
        if (this.cheques.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }
        
        // Prepare data for export
        const exportData = this.cheques.map(cheque => ({
            'Cheque Number': cheque.chequeNo,
            'Amount': cheque.amount,
            'Currency': this.settings.currency,
            'Bank Name': cheque.bankName,
            'Branch': cheque.branch,
            'Payee': cheque.payee,
            'Account Number': cheque.accountNo,
            'Date Issued': cheque.dateIssued,
            'Date to Deposit': cheque.dateDeposited,
            'Status': cheque.status,
            'Notes': cheque.notes,
            'Created Date': cheque.createdAt
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cheques');
        
        const fileName = `cheques-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        this.showNotification('Excel file exported successfully!', 'success');
    }
    
    async updateExistingExcel(file) {
        if (!file) return;
        
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const existingData = XLSX.utils.sheet_to_json(worksheet);
            
            // Add new cheques
            let addedCount = 0;
            this.cheques.forEach(cheque => {
                const exists = existingData.some(row => row['Cheque Number'] === cheque.chequeNo);
                if (!exists) {
                    existingData.push({
                        'Cheque Number': cheque.chequeNo,
                        'Amount': cheque.amount,
                        'Currency': this.settings.currency,
                        'Bank Name': cheque.bankName,
                        'Branch': cheque.branch,
                        'Payee': cheque.payee,
                        'Account Number': cheque.accountNo,
                        'Date Issued': cheque.dateIssued,
                        'Date to Deposit': cheque.dateDeposited,
                        'Status': cheque.status,
                        'Notes': cheque.notes,
                        'Created Date': cheque.createdAt
                    });
                    addedCount++;
                }
            });
            
            const newWorksheet = XLSX.utils.json_to_sheet(existingData);
            workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;
            
            XLSX.writeFile(workbook, file.name);
            
            this.showNotification(`Updated Excel file. Added ${addedCount} new cheques.`, 'success');
            
        } catch (error) {
            console.error('Excel update error:', error);
            this.showNotification('Error updating Excel file', 'error');
        }
    }
    
    async importFromExcel(file) {
        if (!file) return;
        
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const importedData = XLSX.utils.sheet_to_json(worksheet);
            
            let importedCount = 0;
            importedData.forEach(row => {
                const cheque = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    chequeNo: row['Cheque Number'] || row['Cheque No'] || '',
                    amount: parseFloat(row['Amount']) || 0,
                    bankName: row['Bank Name'] || row['Bank'] || '',
                    branch: row['Branch'] || '',
                    payee: row['Payee'] || '',
                    accountNo: row['Account Number'] || row['Account No'] || '',
                    dateIssued: row['Date Issued'] || row['Date'] || new Date().toISOString().split('T')[0],
                    dateDeposited: row['Date to Deposit'] || row['Deposit Date'] || new Date().toISOString().split('T')[0],
                    notes: row['Notes'] || '',
                    status: row['Status'] || 'pending',
                    createdAt: new Date().toISOString()
                };
                
                // Check if cheque already exists
                if (cheque.chequeNo && !this.cheques.some(c => c.chequeNo === cheque.chequeNo)) {
                    this.cheques.push(cheque);
                    importedCount++;
                }
            });
            
            if (importedCount > 0) {
                this.saveToStorage();
                this.loadChequeList();
                this.updateDashboard();
                this.updateDepositSelection();
                this.showNotification(`Imported ${importedCount} cheques from Excel`, 'success');
            } else {
                this.showNotification('No new cheques imported from Excel', 'info');
            }
            
        } catch (error) {
            console.error('Excel import error:', error);
            this.showNotification('Error importing Excel file', 'error');
        }
    }
    
    // Settings Functions
    saveSettings() {
        this.settings = {
            accountHolder: document.getElementById('settingAccountHolder').value,
            defaultBank: document.getElementById('settingDefaultBank').value,
            defaultAccount: document.getElementById('settingDefaultAccount')?.value || '',
            defaultBranch: document.getElementById('settingDefaultBranch')?.value || '',
            currency: document.getElementById('settingCurrency').value,
            dateFormat: document.getElementById('settingDateFormat').value,
            ocrLanguage: document.getElementById('settingOcrLanguage').value,
            autoExtract: document.getElementById('settingAutoExtract').checked,
            saveImages: document.getElementById('settingSaveImages').checked,
            depositNotes: document.getElementById('settingDepositNotes').value,
            preparedBy: document.getElementById('settingPreparedBy').value
        };
        
        localStorage.setItem('chequeSettings', JSON.stringify(this.settings));
        
        // Reinitialize Tesseract with new language if changed
        if (this.tesseractWorker) {
            this.tesseractWorker.terminate();
            this.tesseractWorker = null;
            this.initializeTesseract();
        }
        
        this.showNotification('Settings saved successfully!', 'success');
    }
    
    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            this.settings = this.getDefaultSettings();
            localStorage.setItem('chequeSettings', JSON.stringify(this.settings));
            this.loadSettings();
            this.showNotification('Settings reset to default', 'success');
        }
    }
    
    loadSettings() {
        // This would load settings into the form
        // Implement based on your form structure
    }
    
    // Utility Functions
    formatCurrency(amount) {
        const formatter = new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2
        });
        return formatter.format(amount);
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const formats = {
            'dd/mm/yyyy': () => `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`,
            'mm/dd/yyyy': () => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`,
            'yyyy-mm-dd': () => date.toISOString().split('T')[0]
        };
        
        return formats[this.settings.dateFormat] ? formats[this.settings.dateFormat]() : date.toLocaleDateString();
    }
    
    amountToWords(amount) {
        // Simple amount to words conversion (for LKR)
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        if (amount === 0) return 'Zero rupees only';
        
        let words = '';
        let num = Math.floor(amount);
        
        if (num >= 10000000) {
            words += this.convertToWords(Math.floor(num / 10000000)) + ' Crore ';
            num %= 10000000;
        }
        
        if (num >= 100000) {
            words += this.convertToWords(Math.floor(num / 100000)) + ' Lakh ';
            num %= 100000;
        }
        
        if (num >= 1000) {
            words += this.convertToWords(Math.floor(num / 1000)) + ' Thousand ';
            num %= 1000;
        }
        
        if (num >= 100) {
            words += this.convertToWords(Math.floor(num / 100)) + ' Hundred ';
            num %= 100;
        }
        
        if (num > 0) {
            if (words !== '') words += 'and ';
            
            if (num < 10) {
                words += ones[num];
            } else if (num < 20) {
                words += teens[num - 10];
            } else {
                words += tens[Math.floor(num / 10)];
                if (num % 10 > 0) {
                    words += ' ' + ones[num % 10];
                }
            }
        }
        
        // Add cents
        const cents = Math.round((amount - Math.floor(amount)) * 100);
        if (cents > 0) {
            words += ` and ${cents}/100`;
        }
        
        return words + ' rupees only';
    }
    
    convertToWords(num) {
        // Helper function for converting numbers to words
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        if (num < 10) return ones[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
        return '';
    }
    
    saveToStorage() {
        try {
            localStorage.setItem('cheques', JSON.stringify(this.cheques));
            localStorage.setItem('chequeSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Storage error:', error);
            this.showNotification('Storage limit exceeded. Please export some data.', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(el => el.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        
        notification.innerHTML = `
            <i class="fas fa-${icons[type] || 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#27ae60' : 
                        type === 'error' ? '#e74c3c' : 
                        type === 'warning' ? '#f39c12' : '#3498db'};
            color: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
        `;
        
        // Add to body
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    loadSampleImage() {
        // This would load a sample cheque image for testing
        // For now, we'll just show a message
        this.showNotification('Sample image feature not implemented in this version', 'info');
    }
    
    generateReport() {
        this.showNotification('Report generation not implemented in this version', 'info');
    }
    
    exportReport() {
        this.showNotification('Report export not implemented in this version', 'info');
    }
    
    updatePreview() {
        this.showNotification('Data preview updated', 'info');
    }
}

// Initialize the application
let chequeManager;

document.addEventListener('DOMContentLoaded', () => {
    chequeManager = new ChequeManager();
    
    // Add notification styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
        }
        
        .empty-selection {
            text-align: center;
            padding: 3rem;
            color: #6c757d;
        }
        
        .empty-selection i {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
        }
        
        .cheque-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .cheque-card-body p {
            margin: 0.25rem 0;
            font-size: 0.9rem;
        }
    `;
    document.head.appendChild(style);
});