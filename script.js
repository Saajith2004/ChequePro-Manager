class ChequeProManager {
    constructor() {
        this.cheques = JSON.parse(localStorage.getItem('cheques') || '[]');
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedCheques = new Set();
        this.currentChequeId = null;
        this.currentFile = null;
        
        this.init();
    }
    
    init() {
        this.setCurrentDate();
        this.setupEventListeners();
        this.loadDashboardData();
        this.loadCheques();
        this.updateDepositNotification();
        
        // Set default dates for reports
        const today = new Date();
        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - 30);
        document.getElementById('report-start').valueAsDate = firstDay;
        document.getElementById('report-end').valueAsDate = new Date();
    }
    
    setCurrentDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPage(item.dataset.page);
            });
        });
        
        // Settings tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.showSettingsTab(tab.dataset.tab);
            });
        });
        
        // File upload
        document.getElementById('chequeFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });
        
        // Form submission
        document.getElementById('chequeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCheque();
        });
        
        // Deposit form
        document.getElementById('depositForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateDepositSlip();
        });
        
        // Upload cheque button
        document.getElementById('upload-cheque-btn').addEventListener('click', () => {
            this.showPage('cheque-entry');
        });
        
        // Global search
        document.getElementById('global-search').addEventListener('input', (e) => {
            this.searchCheques(e.target.value);
        });
        
        // Drag and drop for file upload
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#4361ee';
                uploadArea.style.background = 'rgba(67, 97, 238, 0.05)';
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.style.borderColor = '#dee2e6';
                uploadArea.style.background = 'white';
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#dee2e6';
                uploadArea.style.background = 'white';
                
                if (e.dataTransfer.files.length) {
                    this.handleFileUpload(e.dataTransfer.files[0]);
                }
            });
        }
        
        // View all week button
        const viewAllBtn = document.getElementById('view-all-week');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                this.showPage('cheque-list');
            });
        }
    }
    
    showPage(pageId) {
        // Update active menu
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === pageId) {
                item.classList.add('active');
            }
        });
        
        // Update active page
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const pageElement = document.getElementById(pageId);
        if (pageElement) {
            pageElement.classList.add('active');
        }
        
        // Update page title
        const titleMap = {
            'dashboard': 'Dashboard',
            'cheque-entry': 'Cheque Entry',
            'cheque-list': 'Cheque List',
            'deposit-slip': 'Deposit Slip',
            'reports': 'Reports',
            'settings': 'Settings'
        };
        
        document.getElementById('page-title').textContent = titleMap[pageId] || 'Dashboard';
        
        // Refresh data for specific pages
        if (pageId === 'dashboard') {
            this.loadDashboardData();
        } else if (pageId === 'cheque-list') {
            this.loadCheques();
        } else if (pageId === 'reports') {
            this.generateReport();
        }
    }
    
    showSettingsTab(tabId) {
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        event.target.classList.add('active');
        const tabContent = document.getElementById(`${tabId}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
        }
    }
    
    handleFileUpload(file) {
        if (!file) return;
        
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload only JPG, PNG, or PDF files');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImage = document.getElementById('previewImage');
            const uploadPrompt = document.getElementById('uploadPrompt');
            const imagePreview = document.getElementById('imagePreview');
            
            if (file.type === 'application/pdf') {
                previewImage.src = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';
            } else {
                previewImage.src = e.target.result;
            }
            
            if (uploadPrompt) uploadPrompt.style.display = 'none';
            if (imagePreview) imagePreview.style.display = 'block';
            
            // Store file for processing
            this.currentFile = file;
        };
        
        if (file.type === 'application/pdf') {
            reader.readAsDataURL(new Blob(['PDF Preview'], {type: 'text/plain'}));
        } else {
            reader.readAsDataURL(file);
        }
    }
    
    retakePhoto() {
        const uploadPrompt = document.getElementById('uploadPrompt');
        const imagePreview = document.getElementById('imagePreview');
        
        if (uploadPrompt) uploadPrompt.style.display = 'flex';
        if (imagePreview) imagePreview.style.display = 'none';
        
        const chequeFile = document.getElementById('chequeFile');
        if (chequeFile) chequeFile.value = '';
        
        this.currentFile = null;
    }
    
    async processCheque() {
        if (!this.currentFile) {
            alert('Please upload a cheque image first');
            return;
        }
        
        this.showLoading('Extracting cheque information...');
        
        try {
            let extractedData;
            
            if (this.currentFile.type === 'application/pdf') {
                extractedData = await this.extractFromPDF(this.currentFile);
            } else {
                extractedData = await this.extractFromImage(this.currentFile);
            }
            
            this.populateForm(extractedData);
            
        } catch (error) {
            console.error('OCR Error:', error);
            alert('Could not extract data automatically. Please enter manually.');
        } finally {
            this.hideLoading();
        }
    }
    
    async extractFromImage(file) {
        try {
            // Check if Tesseract is available
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract.js not loaded');
            }
            
            const worker = await Tesseract.createWorker('eng');
            const { data: { text } } = await worker.recognize(file);
            await worker.terminate();
            
            return this.parseChequeText(text);
        } catch (error) {
            console.warn('Tesseract not available, using mock data');
            return this.getMockChequeData();
        }
    }
    
    async extractFromPDF(file) {
        // For PDFs, we'd need PDF.js or similar
        // This is a simplified version
        alert('PDF processing requires additional setup. Please use image files for OCR.');
        
        return this.getMockChequeData();
    }
    
    getMockChequeData() {
        // Mock data for testing
        return {
            bankName: "PEOPLE'S BANK",
            branch: "Headquarters Branch",
            accountNumber: "204100150001776",
            chequeNumber: "E7E931",
            payee: "MR.K.S.N.PERERA",
            amountInWords: "One Million Two Hundred and Six Thousand Two Hundred and Fifty Only",
            amountInNumbers: "20206250.00",
            nicNumber: "751240406V",
            micrCode: "7135 2014 0001778001"
        };
    }
    
    parseChequeText(text) {
        // Parse the OCR text - this would need to be customized for different cheque formats
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        let bankName = '';
        let branch = '';
        let accountNumber = '';
        let chequeNumber = '';
        let payee = '';
        let amountInWords = '';
        let amountInNumbers = '';
        let nicNumber = '';
        let micrCode = '';
        
        // Simple pattern matching
        lines.forEach(line => {
            const upperLine = line.toUpperCase();
            if (upperLine.includes("PEOPLE'S BANK") || upperLine.includes("PEOPLES BANK")) {
                bankName = "PEOPLE'S BANK";
            }
            if (upperLine.includes("BRANCH:")) {
                branch = line.replace("BRANCH:", "").trim();
            }
            if (upperLine.includes("A/C") || upperLine.includes("ACCOUNT")) {
                const match = line.match(/\d+/);
                if (match) accountNumber = match[0];
            }
            if ((upperLine.includes("MR.") || upperLine.includes("MRS.") || upperLine.includes("MS.")) && 
                !upperLine.includes("BANK")) {
                payee = line;
            }
            if (line.includes("Only") || line.includes("ONLY")) {
                amountInWords = line;
            }
            const amountMatch = line.match(/Rs?\.?\s*([\d,]+\.\d{2})/i);
            if (amountMatch) {
                amountInNumbers = amountMatch[1].replace(/,/g, '');
            }
            const nicMatch = line.match(/(\d{9}[Vv])/);
            if (nicMatch) {
                nicNumber = nicMatch[1].toUpperCase();
            }
        });
        
        // If no data found, use mock data
        if (!bankName && !payee) {
            return this.getMockChequeData();
        }
        
        return {
            bankName: bankName || "PEOPLE'S BANK",
            branch: branch || "Headquarters Branch",
            accountNumber: accountNumber || "204100150001776",
            chequeNumber: chequeNumber || "E7E931",
            payee: payee || "MR.K.S.N.PERERA",
            amountInWords: amountInWords || "One Million Two Hundred and Six Thousand Two Hundred and Fifty Only",
            amountInNumbers: amountInNumbers || "20206250.00",
            nicNumber: nicNumber || "751240406V",
            micrCode: micrCode || "7135 2014 0001778001"
        };
    }
    
    populateForm(data) {
        document.getElementById('bankName').value = data.bankName || '';
        document.getElementById('branch').value = data.branch || '';
        document.getElementById('accountNumber').value = data.accountNumber || '';
        document.getElementById('chequeNumber').value = data.chequeNumber || '';
        document.getElementById('payee').value = data.payee || '';
        document.getElementById('nicNumber').value = data.nicNumber || '';
        document.getElementById('amountWords').value = data.amountInWords || '';
        document.getElementById('amountNumbers').value = data.amountInNumbers || '';
        document.getElementById('micrCode').value = data.micrCode || '';
        
        // Set current date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('chequeDate').value = today;
    }
    
    async saveCheque() {
        // Get file data first
        let imageData = null;
        if (this.currentFile) {
            imageData = await this.getFileData(this.currentFile);
        }
        
        const formData = {
            id: Date.now().toString(),
            bankName: document.getElementById('bankName').value.trim(),
            branch: document.getElementById('branch').value.trim(),
            accountNumber: document.getElementById('accountNumber').value.trim(),
            chequeNumber: document.getElementById('chequeNumber').value.trim(),
            payee: document.getElementById('payee').value.trim(),
            nicNumber: document.getElementById('nicNumber').value.trim(),
            amountInWords: document.getElementById('amountWords').value.trim(),
            amountInNumbers: parseFloat(document.getElementById('amountNumbers').value) || 0,
            chequeDate: document.getElementById('chequeDate').value,
            micrCode: document.getElementById('micrCode').value.trim(),
            status: document.getElementById('status').value,
            uploadedAt: new Date().toISOString(),
            imageData: imageData
        };
        
        // Validate required fields
        if (!formData.bankName || !formData.chequeNumber || !formData.payee || !formData.amountInNumbers) {
            alert('Please fill in all required fields');
            return;
        }
        
        this.cheques.unshift(formData);
        this.saveToStorage();
        
        alert('Cheque saved successfully!');
        this.clearForm();
        this.showPage('cheque-list');
        this.loadCheques();
    }
    
    getFileData(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    type: file.type,
                    data: e.target.result
                });
            };
            reader.readAsDataURL(file);
        });
    }
    
    clearForm() {
        document.getElementById('chequeForm').reset();
        this.retakePhoto();
        document.getElementById('status').value = 'pending';
        
        // Remove delete button if exists
        const deleteBtn = document.querySelector('.btn-danger');
        if (deleteBtn) {
            deleteBtn.remove();
        }
    }
    
    saveToStorage() {
        localStorage.setItem('cheques', JSON.stringify(this.cheques));
    }
    
    loadDashboardData() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        
        const weekCheques = this.cheques.filter(cheque => {
            const chequeDate = new Date(cheque.chequeDate);
            return chequeDate >= weekStart;
        });
        
        const pendingDeposit = this.cheques.filter(c => c.status === 'pending').length;
        const totalAmount = this.cheques.reduce((sum, c) => sum + c.amountInNumbers, 0);
        const avgAmount = this.cheques.length ? totalAmount / this.cheques.length : 0;
        
        // Update stats
        document.getElementById('total-cheques').textContent = this.cheques.length;
        document.getElementById('week-cheques').textContent = weekCheques.length;
        document.getElementById('processed-cheques').textContent = this.cheques.filter(c => c.status === 'processed').length;
        document.getElementById('process-rate').textContent = this.cheques.length ? 
            Math.round((this.cheques.filter(c => c.status === 'processed').length / this.cheques.length) * 100) + '%' : '0%';
        document.getElementById('pending-deposit').textContent = pendingDeposit;
        document.getElementById('total-amount').textContent = 'LKR ' + totalAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        document.getElementById('avg-amount').textContent = 'LKR ' + avgAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        // Update deposit notification
        const depositNotification = document.getElementById('deposit-notification');
        if (depositNotification) {
            if (pendingDeposit > 0) {
                depositNotification.innerHTML = `<span style="color: #f8961e; font-weight: 600;">
                    ${pendingDeposit} cheques pending deposit this week</span>`;
            } else {
                depositNotification.textContent = 'No cheques this week';
            }
        }
        
        // Load weekly cheques table
        this.loadWeeklyCheques(weekCheques);
        
        // Load recent activity
        this.loadRecentActivity();
    }
    
    loadWeeklyCheques(weekCheques) {
        const tbody = document.getElementById('weekly-cheques-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        const displayCheques = weekCheques.slice(0, 5); // Show only 5
        
        if (displayCheques.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">No cheques this week</td>
                </tr>
            `;
            return;
        }
        
        displayCheques.forEach(cheque => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cheque.chequeNumber || 'N/A'}</td>
                <td>${cheque.bankName}</td>
                <td>${cheque.payee}</td>
                <td>LKR ${cheque.amountInNumbers.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}</td>
                <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td>
                    <button class="btn-icon" onclick="app.viewCheque('${cheque.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="app.selectForDeposit('${cheque.id}')" title="Select for Deposit">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    loadRecentActivity() {
        const container = document.getElementById('recent-activity');
        if (!container) return;
        
        const recent = this.cheques.slice(0, 5);
        
        if (recent.length === 0) {
            container.innerHTML = `
                <div class="activity-item">
                    <i class="fas fa-plus-circle activity-icon"></i>
                    <div class="activity-content">
                        <p>No recent activity</p>
                        <span class="activity-time">--</span>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recent.map(cheque => `
            <div class="activity-item">
                <i class="fas fa-file-invoice-dollar activity-icon"></i>
                <div class="activity-content">
                    <p>Cheque ${cheque.chequeNumber} added</p>
                    <span class="activity-time">${new Date(cheque.uploadedAt).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');
    }
    
    loadCheques(page = 1) {
        this.currentPage = page;
        const start = (page - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const displayCheques = this.cheques.slice(start, end);
        
        const tbody = document.getElementById('cheques-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (this.cheques.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="no-data">No cheques found. Add your first cheque!</td>
                </tr>
            `;
            return;
        }
        
        displayCheques.forEach(cheque => {
            const isSelected = this.selectedCheques.has(cheque.id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           onchange="app.toggleChequeSelection('${cheque.id}', this.checked)">
                </td>
                <td>${cheque.chequeNumber || 'N/A'}</td>
                <td>${cheque.bankName}</td>
                <td>${cheque.branch}</td>
                <td>${cheque.payee}</td>
                <td>LKR ${cheque.amountInNumbers.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}</td>
                <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="app.viewCheque('${cheque.id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="app.editCheque('${cheque.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="app.deleteCheque('${cheque.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        this.updatePagination();
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.cheques.length / this.itemsPerPage);
        document.getElementById('current-page').textContent = this.currentPage;
        document.getElementById('total-pages').textContent = totalPages;
        
        const pageBtns = document.querySelectorAll('.page-btn');
        pageBtns.forEach(btn => {
            btn.disabled = false;
        });
        
        if (this.currentPage <= 1) {
            const firstBtn = document.querySelector('.page-btn:first-child');
            if (firstBtn) firstBtn.disabled = true;
        }
        
        if (this.currentPage >= totalPages) {
            const lastBtn = document.querySelector('.page-btn:last-child');
            if (lastBtn) lastBtn.disabled = true;
        }
    }
    
    changePage(delta) {
        const newPage = this.currentPage + delta;
        const totalPages = Math.ceil(this.cheques.length / this.itemsPerPage);
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.loadCheques(newPage);
        }
    }
    
    searchCheques(query) {
        const searchInput = document.getElementById('search-cheques');
        if (searchInput) {
            query = query || searchInput.value;
        }
        
        const tbody = document.getElementById('cheques-body');
        if (!tbody) return;
        
        if (!query || !query.trim()) {
            this.loadCheques(1);
            return;
        }
        
        const searchTerm = query.toLowerCase();
        const filtered = this.cheques.filter(cheque =>
            (cheque.chequeNumber && cheque.chequeNumber.toLowerCase().includes(searchTerm)) ||
            (cheque.bankName && cheque.bankName.toLowerCase().includes(searchTerm)) ||
            (cheque.payee && cheque.payee.toLowerCase().includes(searchTerm)) ||
            (cheque.branch && cheque.branch.toLowerCase().includes(searchTerm))
        );
        
        tbody.innerHTML = '';
        
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="no-data">No cheques found matching "${query}"</td>
                </tr>
            `;
            return;
        }
        
        filtered.slice(0, this.itemsPerPage).forEach(cheque => {
            const isSelected = this.selectedCheques.has(cheque.id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           onchange="app.toggleChequeSelection('${cheque.id}', this.checked)">
                </td>
                <td>${cheque.chequeNumber || 'N/A'}</td>
                <td>${cheque.bankName}</td>
                <td>${cheque.branch}</td>
                <td>${cheque.payee}</td>
                <td>LKR ${cheque.amountInNumbers.toLocaleString()}</td>
                <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="app.viewCheque('${cheque.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="app.editCheque('${cheque.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="app.deleteCheque('${cheque.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    toggleChequeSelection(id, isSelected) {
        if (isSelected) {
            this.selectedCheques.add(id);
        } else {
            this.selectedCheques.delete(id);
        }
        this.updateSelectedCheques();
    }
    
    toggleSelectAll() {
        const selectAll = document.getElementById('select-all');
        if (!selectAll) return;
        
        const isChecked = selectAll.checked;
        const checkboxes = document.querySelectorAll('#cheques-body input[type="checkbox"]');
        
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = isChecked;
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const cheque = this.cheques[start + index];
            if (cheque) {
                if (isChecked) {
                    this.selectedCheques.add(cheque.id);
                } else {
                    this.selectedCheques.delete(cheque.id);
                }
            }
        });
        
        this.updateSelectedCheques();
    }
    
    updateSelectedCheques() {
        const selectedContainer = document.getElementById('selected-cheques');
        const selectedCount = document.getElementById('selected-count');
        const selectedAmount = document.getElementById('selected-amount');
        
        if (!selectedContainer || !selectedCount || !selectedAmount) return;
        
        const selectedChequeData = this.cheques.filter(c => this.selectedCheques.has(c.id));
        
        selectedCount.textContent = selectedChequeData.length;
        
        const totalAmount = selectedChequeData.reduce((sum, c) => sum + c.amountInNumbers, 0);
        selectedAmount.textContent = 'LKR ' + totalAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        if (selectedChequeData.length === 0) {
            selectedContainer.innerHTML = `
                <div class="no-selection">
                    <i class="fas fa-receipt"></i>
                    <p>No cheques selected</p>
                    <small>Select cheques from the list to include in deposit slip</small>
                </div>
            `;
            return;
        }
        
        selectedContainer.innerHTML = selectedChequeData.map(cheque => `
            <div class="selected-item">
                <div>
                    <strong>${cheque.chequeNumber}</strong>
                    <small>${cheque.bankName}</small>
                </div>
                <div class="selected-info">
                    <span>LKR ${cheque.amountInNumbers.toLocaleString()}</span>
                    <button class="btn-icon" onclick="app.removeFromSelection('${cheque.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    removeFromSelection(id) {
        this.selectedCheques.delete(id);
        this.updateSelectedCheques();
        this.loadCheques(this.currentPage);
    }
    
    clearSelected() {
        this.selectedCheques.clear();
        const selectAll = document.getElementById('select-all');
        if (selectAll) selectAll.checked = false;
        
        this.updateSelectedCheques();
        this.loadCheques(this.currentPage);
    }
    
    selectForDeposit(id) {
        this.selectedCheques.add(id);
        this.updateSelectedCheques();
        this.showPage('deposit-slip');
    }
    
    updateDepositNotification() {
        const pending = this.cheques.filter(c => c.status === 'pending').length;
        const badge = document.querySelector('.badge');
        
        if (badge) {
            if (pending > 0) {
                badge.textContent = pending > 9 ? '9+' : pending;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    viewCheque(id) {
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) return;
        
        this.currentChequeId = id;
        
        // Set image if available
        const imageElement = document.getElementById('view-cheque-img');
        if (cheque.imageData && cheque.imageData.data) {
            imageElement.src = cheque.imageData.data;
        } else {
            imageElement.src = 'https://via.placeholder.com/400x200?text=No+Image+Available';
        }
        
        // Populate details
        const detailsGrid = document.getElementById('cheque-details-grid');
        detailsGrid.innerHTML = `
            <div class="detail-item">
                <div class="detail-label">Bank Name</div>
                <div class="detail-value">${cheque.bankName}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Branch</div>
                <div class="detail-value">${cheque.branch}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Account Number</div>
                <div class="detail-value">${cheque.accountNumber}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Cheque Number</div>
                <div class="detail-value">${cheque.chequeNumber}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Payee</div>
                <div class="detail-value">${cheque.payee}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">NIC Number</div>
                <div class="detail-value">${cheque.nicNumber || 'N/A'}</div>
            </div>
            <div class="detail-item full-width">
                <div class="detail-label">Amount in Words</div>
                <div class="detail-value">${cheque.amountInWords}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Amount (LKR)</div>
                <div class="detail-value">${cheque.amountInNumbers.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date</div>
                <div class="detail-value">${new Date(cheque.chequeDate).toLocaleDateString()}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Status</div>
                <div class="detail-value"><span class="status-badge status-${cheque.status}">${cheque.status}</span></div>
            </div>
            <div class="detail-item full-width">
                <div class="detail-label">MICR Code</div>
                <div class="detail-value">${cheque.micrCode || 'N/A'}</div>
            </div>
        `;
        
        // Show modal
        document.getElementById('chequeViewModal').style.display = 'flex';
    }
    
    closeModal() {
        document.getElementById('chequeViewModal').style.display = 'none';
    }
    
    editCheque(id) {
        if (!id && !this.currentChequeId) return;
        
        const chequeId = id || this.currentChequeId;
        const cheque = this.cheques.find(c => c.id === chequeId);
        if (!cheque) return;
        
        this.closeModal();
        this.showPage('cheque-entry');
        
        // Populate form with cheque data
        document.getElementById('bankName').value = cheque.bankName;
        document.getElementById('branch').value = cheque.branch;
        document.getElementById('accountNumber').value = cheque.accountNumber;
        document.getElementById('chequeNumber').value = cheque.chequeNumber;
        document.getElementById('payee').value = cheque.payee;
        document.getElementById('nicNumber').value = cheque.nicNumber || '';
        document.getElementById('amountWords').value = cheque.amountInWords;
        document.getElementById('amountNumbers').value = cheque.amountInNumbers;
        document.getElementById('chequeDate').value = cheque.chequeDate;
        document.getElementById('micrCode').value = cheque.micrCode || '';
        document.getElementById('status').value = cheque.status;
        
        // Show delete button
        const formActions = document.querySelector('.form-actions');
        let deleteBtn = document.querySelector('.btn-danger');
        
        if (!deleteBtn) {
            deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
            deleteBtn.onclick = () => this.deleteCurrentCheque();
            formActions.appendChild(deleteBtn);
        }
        
        // Store current cheque ID for deletion
        this.currentChequeId = chequeId;
    }
    
    deleteCurrentCheque() {
        if (!this.currentChequeId) return;
        
        if (confirm('Are you sure you want to delete this cheque?')) {
            this.cheques = this.cheques.filter(c => c.id !== this.currentChequeId);
            this.saveToStorage();
            this.clearForm();
            this.showPage('cheque-list');
            this.loadCheques();
            alert('Cheque deleted successfully');
        }
    }
    
    deleteCheque(id) {
        if (confirm('Are you sure you want to delete this cheque?')) {
            this.cheques = this.cheques.filter(c => c.id !== id);
            this.saveToStorage();
            this.loadCheques(this.currentPage);
            this.updateDepositNotification();
            alert('Cheque deleted successfully');
        }
    }
    
    generateDepositSlip() {
        const selectedChequeData = this.cheques.filter(c => this.selectedCheques.has(c.id));
        
        if (selectedChequeData.length === 0) {
            alert('Please select at least one cheque for deposit');
            return;
        }
        
        const depositData = {
            date: document.getElementById('depositDate').value,
            bank: document.getElementById('depositBank').value,
            branch: document.getElementById('depositBranch').value,
            account: document.getElementById('depositAccount').value,
            reference: document.getElementById('depositRef').value,
            notes: document.getElementById('depositNotes').value,
            cheques: selectedChequeData,
            totalAmount: selectedChequeData.reduce((sum, c) => sum + c.amountInNumbers, 0),
            generatedAt: new Date().toISOString()
        };
        
        // Update cheque statuses
        selectedChequeData.forEach(cheque => {
            cheque.status = 'deposited';
        });
        this.saveToStorage();
        
        // Generate slip HTML
        const slipWindow = window.open('', '_blank');
        slipWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Deposit Slip</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .details { margin-bottom: 20px; }
                    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .table th, .table td { border: 1px solid #000; padding: 8px; }
                    .total { text-align: right; font-size: 18px; font-weight: bold; }
                    .footer { margin-top: 40px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>BANK DEPOSIT SLIP</h2>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="details">
                    <p><strong>Deposit Bank:</strong> ${depositData.bank}</p>
                    <p><strong>Branch:</strong> ${depositData.branch}</p>
                    <p><strong>Account Number:</strong> ${depositData.account}</p>
                    <p><strong>Deposit Date:</strong> ${new Date(depositData.date).toLocaleDateString()}</p>
                    <p><strong>Reference:</strong> ${depositData.reference || 'N/A'}</p>
                </div>
                
                <table class="table">
                    <thead>
                        <tr>
                            <th>Cheque No</th>
                            <th>Bank</th>
                            <th>Payee</th>
                            <th>Amount (LKR)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedChequeData.map(cheque => `
                            <tr>
                                <td>${cheque.chequeNumber}</td>
                                <td>${cheque.bankName}</td>
                                <td>${cheque.payee}</td>
                                <td>${cheque.amountInNumbers.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="total">
                    <p>TOTAL AMOUNT: LKR ${depositData.totalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}</p>
                </div>
                
                <div class="footer">
                    <p>${depositData.notes || ''}</p>
                    <p>Generated by ChequePro Manager</p>
                </div>
            </body>
            </html>
        `);
        slipWindow.document.close();
        
        // Clear selection
        this.clearSelected();
        alert('Deposit slip generated successfully!');
    }
    
    generateReport() {
        const startDate = document.getElementById('report-start').value;
        const endDate = document.getElementById('report-end').value;
        
        if (!startDate || !endDate) {
            alert('Please select both start and end dates');
            return;
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const filteredCheques = this.cheques.filter(cheque => {
            const chequeDate = new Date(cheque.chequeDate);
            return chequeDate >= start && chequeDate <= end;
        });
        
        // Update summary
        const totalAmount = filteredCheques.reduce((sum, c) => sum + c.amountInNumbers, 0);
        const uniqueBanks = [...new Set(filteredCheques.map(c => c.bankName))].length;
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const dailyAverage = totalAmount / daysDiff;
        
        document.getElementById('report-total').textContent = 'LKR ' + totalAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        document.getElementById('report-count').textContent = filteredCheques.length;
        document.getElementById('report-banks').textContent = uniqueBanks;
        document.getElementById('report-daily').textContent = 'LKR ' + dailyAverage.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        // Update detailed report table
        const tbody = document.getElementById('report-body');
        tbody.innerHTML = '';
        
        if (filteredCheques.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">No cheques found in selected period</td>
                </tr>
            `;
            return;
        }
        
        filteredCheques.forEach(cheque => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                <td>${cheque.chequeNumber}</td>
                <td>${cheque.bankName}</td>
                <td>${cheque.payee}</td>
                <td>LKR ${cheque.amountInNumbers.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }
    
    exportToExcel() {
        if (this.cheques.length === 0) {
            alert('No cheques to export');
            return;
        }
        
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Headers
        csvContent += "Cheque Number,Bank Name,Branch,Payee,NIC,Amount,Amount in Words,Date,Status,MICR Code\n";
        
        // Data
        this.cheques.forEach(cheque => {
            const row = [
                cheque.chequeNumber,
                cheque.bankName,
                cheque.branch,
                cheque.payee,
                cheque.nicNumber,
                cheque.amountInNumbers,
                `"${cheque.amountInWords}"`,
                cheque.chequeDate,
                cheque.status,
                cheque.micrCode
            ].join(',');
            csvContent += row + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `cheques_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    exportReport() {
        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cheque Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
                    .summary-card { border: 1px solid #000; padding: 15px; text-align: center; }
                    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .table th, .table td { border: 1px solid #000; padding: 8px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ChequePro Manager Report</h1>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="summary">
                    <div class="summary-card">
                        <h3>Total Amount</h3>
                        <p>LKR ${this.cheques.reduce((sum, c) => sum + c.amountInNumbers, 0).toLocaleString()}</p>
                    </div>
                    <div class="summary-card">
                        <h3>Total Cheques</h3>
                        <p>${this.cheques.length}</p>
                    </div>
                    <div class="summary-card">
                        <h3>Unique Banks</h3>
                        <p>${[...new Set(this.cheques.map(c => c.bankName))].length}</p>
                    </div>
                    <div class="summary-card">
                        <h3>Avg. Amount</h3>
                        <p>LKR ${(this.cheques.reduce((sum, c) => sum + c.amountInNumbers, 0) / this.cheques.length || 0).toLocaleString()}</p>
                    </div>
                </div>
                
                <table class="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Cheque No</th>
                            <th>Bank</th>
                            <th>Payee</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.cheques.map(cheque => `
                            <tr>
                                <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                                <td>${cheque.chequeNumber}</td>
                                <td>${cheque.bankName}</td>
                                <td>${cheque.payee}</td>
                                <td>LKR ${cheque.amountInNumbers.toLocaleString()}</td>
                                <td>${cheque.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        reportWindow.document.close();
    }
    
    testOCR() {
        alert('OCR test would be implemented here with a sample image');
    }
    
    showLoading(message = 'Processing...') {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <p>${message}</p>
        `;
        document.body.appendChild(overlay);
    }
    
    hideLoading() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.remove();
    }
}

// Initialize app when page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ChequeProManager();
    
    // Make app available globally for onclick handlers
    window.app = app;
});

// Global functions for onclick handlers
function openFilterModal() {
    alert('Filter modal would open here');
}

function closeModal() {
    if (app) app.closeModal();
}

function retakePhoto() {
    if (app) app.retakePhoto();
}

function processCheque() {
    if (app) app.processCheque();
}

function clearForm() {
    if (app) app.clearForm();
}

function generateReport() {
    if (app) app.generateReport();
}

function generateDepositSlip() {
    if (app) app.generateDepositSlip();
}

function clearSelected() {
    if (app) app.clearSelected();
}

function exportToExcel() {
    if (app) app.exportToExcel();
}

function exportReport() {
    if (app) app.exportReport();
}

function searchCheques() {
    if (app) {
        const input = document.getElementById('search-cheques');
        if (input) app.searchCheques(input.value);
    }
}

function toggleSelectAll() {
    if (app) app.toggleSelectAll();
}

function changePage(delta) {
    if (app) app.changePage(delta);
}

// Make functions available globally
window.openFilterModal = openFilterModal;
window.closeModal = closeModal;
window.retakePhoto = retakePhoto;
window.processCheque = processCheque;
window.clearForm = clearForm;
window.generateReport = generateReport;
window.generateDepositSlip = generateDepositSlip;
window.clearSelected = clearSelected;
window.exportToExcel = exportToExcel;
window.exportReport = exportReport;
window.searchCheques = searchCheques;
window.toggleSelectAll = toggleSelectAll;
window.changePage = changePage;