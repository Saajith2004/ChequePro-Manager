class ChequeManager {
    constructor() {
        this.cheques = JSON.parse(localStorage.getItem('cheques')) || [];
        this.settings = JSON.parse(localStorage.getItem('chequeSettings')) || this.getDefaultSettings();
        this.currentImage = null;
        this.currentCameraStream = null;
        
        this.init();
    }
    
    getDefaultSettings() {
        return {
            defaultBank: '',
            defaultAccount: '',
            dateFormat: 'mm/dd/yyyy',
            currency: 'USD',
            ocrLanguage: 'eng',
            autoExtract: false,
            saveImage: true
        };
    }
    
    init() {
        this.setupEventListeners();
        this.loadChequeList();
        this.updateStats();
        this.setCurrentDate();
        this.loadSettings();
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-menu li').forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                this.switchTab(tabId);
                document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
                item.classList.add('active');
            });
        });
        
        // Image upload
        const uploadArea = document.getElementById('uploadArea');
        const imageUpload = document.getElementById('imageUpload');
        
        uploadArea.addEventListener('click', () => imageUpload.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#3498db';
            uploadArea.style.background = '#f8f9fa';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#bdc3c7';
            uploadArea.style.background = 'white';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#bdc3c7';
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
        
        // Capture photo button
        document.getElementById('captureBtn').addEventListener('click', () => {
            this.openCamera();
        });
        
        // Extract data button
        document.getElementById('extractBtn').addEventListener('click', () => {
            this.extractDataFromImage();
        });
        
        // Form submission
        document.getElementById('chequeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCheque();
        });
        
        // Generate deposit slip button
        document.getElementById('generateDepositBtn').addEventListener('click', () => {
            this.generateDepositSlip();
        });
        
        // Export to Excel
        document.getElementById('exportExcel').addEventListener('click', () => {
            this.exportToExcel();
        });
        
        // Update existing Excel file
        document.getElementById('updateExcel').addEventListener('click', () => {
            document.getElementById('excelFileInput').click();
        });
        
        document.getElementById('excelFileInput').addEventListener('change', (e) => {
            this.updateExistingExcel(e.target.files[0]);
        });
        
        // Import from Excel
        document.getElementById('importExcel').addEventListener('click', () => {
            this.importFromExcel();
        });
        
        // Refresh list
        document.getElementById('refreshList').addEventListener('click', () => {
            this.loadChequeList();
        });
        
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchCheques(e.target.value);
        });
        
        // Deposit slip controls
        document.getElementById('printDepositSlip').addEventListener('click', () => {
            this.printDepositSlip();
        });
        
        document.getElementById('saveDepositPDF').addEventListener('click', () => {
            this.saveDepositAsPDF();
        });
        
        // Settings
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetSettings();
        });
        
        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModals();
            });
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });
    }
    
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');
    }
    
    handleImageUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            const preview = document.getElementById('imagePreview');
            preview.innerHTML = `<img src="${this.currentImage}" alt="Cheque Preview">`;
            document.getElementById('extractBtn').disabled = false;
            
            if (this.settings.autoExtract) {
                this.extractDataFromImage();
            }
        };
        reader.readAsDataURL(file);
    }
    
    openCamera() {
        const modal = document.getElementById('cameraModal');
        modal.style.display = 'flex';
        
        const video = document.getElementById('cameraPreview');
        const constraints = { video: { facingMode: 'environment' } };
        
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                this.currentCameraStream = stream;
                video.srcObject = stream;
            })
            .catch(err => {
                console.error('Camera error:', err);
                alert('Unable to access camera. Please check permissions.');
            });
        
        // Setup camera controls
        document.getElementById('capturePhotoBtn').onclick = () => {
            this.capturePhoto(video);
        };
        
        document.getElementById('switchCamera').onclick = () => {
            this.switchCamera(video);
        };
    }
    
    capturePhoto(video) {
        const canvas = document.getElementById('photoCanvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        this.currentImage = canvas.toDataURL('image/jpeg');
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${this.currentImage}" alt="Captured Cheque">`;
        document.getElementById('extractBtn').disabled = false;
        
        // Stop camera stream
        if (this.currentCameraStream) {
            this.currentCameraStream.getTracks().forEach(track => track.stop());
        }
        
        this.closeModals();
    }
    
    switchCamera(video) {
        if (this.currentCameraStream) {
            this.currentCameraStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = { 
            video: { 
                facingMode: video.srcObject.getVideoTracks()[0].getSettings().facingMode === 'user' 
                    ? 'environment' 
                    : 'user' 
            } 
        };
        
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                this.currentCameraStream = stream;
                video.srcObject = stream;
            })
            .catch(err => {
                console.error('Camera switch error:', err);
            });
    }
    
    async extractDataFromImage() {
        if (!this.currentImage) return;
        
        const statusDiv = document.getElementById('ocrStatus');
        statusDiv.className = 'ocr-status extracting';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting text from image...';
        
        try {
            const worker = await Tesseract.createWorker(this.settings.ocrLanguage);
            const result = await worker.recognize(this.currentImage);
            await worker.terminate();
            
            statusDiv.className = 'ocr-status success';
            statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Text extracted successfully!';
            
            this.parseExtractedText(result.data.text);
        } catch (error) {
            console.error('OCR Error:', error);
            statusDiv.className = 'ocr-status error';
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to extract text. Please enter manually.';
        }
    }
    
    parseExtractedText(text) {
        // This is a simplified parser. In production, you'd want a more sophisticated parser
        const lines = text.split('\n').filter(line => line.trim());
        
        // Simple pattern matching for common cheque fields
        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            
            // Look for amount patterns
            const amountMatch = line.match(/(\$|€|£|¥)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
            if (amountMatch) {
                document.getElementById('amount').value = amountMatch[2].replace(/,/g, '');
            }
            
            // Look for cheque number patterns
            const chequeNoMatch = line.match(/cheque\s*#?\s*:?\s*(\d+)/i) || line.match(/no\.?\s*:?\s*(\d+)/i);
            if (chequeNoMatch) {
                document.getElementById('chequeNo').value = chequeNoMatch[1];
            }
            
            // Look for date patterns
            const dateMatch = line.match(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/);
            if (dateMatch && !document.getElementById('dateIssued').value) {
                document.getElementById('dateIssued').value = this.formatDateForInput(dateMatch[0]);
            }
            
            // Look for bank names (simplified)
            const bankKeywords = ['bank', 'trust', 'national', 'federal', 'savings'];
            if (bankKeywords.some(keyword => lowerLine.includes(keyword))) {
                document.getElementById('bankName').value = line;
            }
        });
    }
    
    formatDateForInput(dateString) {
        // Convert various date formats to YYYY-MM-DD for input type="date"
        const parts = dateString.split(/[-/]/);
        if (parts.length === 3) {
            let year, month, day;
            
            if (parts[0].length === 4) { // YYYY-MM-DD
                [year, month, day] = parts;
            } else { // MM/DD/YYYY or DD/MM/YYYY
                month = parts[0].padStart(2, '0');
                day = parts[1].padStart(2, '0');
                year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            }
            
            return `${year}-${month}-${day}`;
        }
        return '';
    }
    
    saveCheque() {
        const cheque = {
            id: Date.now().toString(),
            chequeNo: document.getElementById('chequeNo').value,
            amount: parseFloat(document.getElementById('amount').value),
            bankName: document.getElementById('bankName').value,
            branch: document.getElementById('branch').value,
            payee: document.getElementById('payee').value,
            accountNo: document.getElementById('accountNo').value,
            dateIssued: document.getElementById('dateIssued').value,
            dateDeposited: document.getElementById('dateDeposited').value,
            notes: document.getElementById('notes').value,
            status: 'pending',
            image: this.settings.saveImage ? this.currentImage : null,
            createdAt: new Date().toISOString()
        };
        
        this.cheques.unshift(cheque);
        this.saveToLocalStorage();
        this.loadChequeList();
        this.updateStats();
        
        // Clear form
        document.getElementById('chequeForm').reset();
        document.getElementById('imagePreview').innerHTML = '<p>No image selected</p>';
        this.currentImage = null;
        document.getElementById('extractBtn').disabled = true;
        
        // Show success message
        this.showNotification('Cheque saved successfully!', 'success');
    }
    
    loadChequeList() {
        const tbody = document.getElementById('chequeTableBody');
        tbody.innerHTML = '';
        
        this.cheques.forEach(cheque => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cheque.chequeNo}</td>
                <td>${cheque.payee}</td>
                <td>${cheque.bankName}</td>
                <td>${this.formatCurrency(cheque.amount)}</td>
                <td>${this.formatDate(cheque.dateIssued)}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td>
                    <button class="btn small" onclick="chequeManager.viewCheque('${cheque.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn small secondary" onclick="chequeManager.editCheque('${cheque.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn small danger" onclick="chequeManager.deleteCheque('${cheque.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        document.getElementById('dataCount').textContent = `${this.cheques.length} cheques stored`;
        document.getElementById('lastSaved').textContent = `Last saved: ${new Date().toLocaleTimeString()}`;
    }
    
    viewCheque(id) {
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) return;
        
        const modal = document.getElementById('editModal');
        const modalBody = modal.querySelector('.modal-body');
        
        modalBody.innerHTML = `
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
                    <strong>Payee:</strong> ${cheque.payee}
                </div>
                <div class="detail-row">
                    <strong>Date Issued:</strong> ${this.formatDate(cheque.dateIssued)}
                </div>
                <div class="detail-row">
                    <strong>Notes:</strong> ${cheque.notes || 'None'}
                </div>
                ${cheque.image ? `
                <div class="detail-row">
                    <strong>Image:</strong><br>
                    <img src="${cheque.image}" style="max-width: 100%; margin-top: 10px;">
                </div>
                ` : ''}
            </div>
        `;
        
        modal.style.display = 'flex';
    }
    
    editCheque(id) {
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) return;
        
        const modal = document.getElementById('editModal');
        const modalBody = modal.querySelector('.modal-body');
        
        modalBody.innerHTML = `
            <form id="editChequeForm">
                <input type="hidden" id="editId" value="${cheque.id}">
                <div class="form-group">
                    <label for="editChequeNo">Cheque Number</label>
                    <input type="text" id="editChequeNo" value="${cheque.chequeNo}" required>
                </div>
                <div class="form-group">
                    <label for="editAmount">Amount</label>
                    <input type="number" id="editAmount" value="${cheque.amount}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="editBankName">Bank Name</label>
                    <input type="text" id="editBankName" value="${cheque.bankName}" required>
                </div>
                <div class="form-group">
                    <label for="editPayee">Payee</label>
                    <input type="text" id="editPayee" value="${cheque.payee}" required>
                </div>
                <div class="form-group">
                    <label for="editStatus">Status</label>
                    <select id="editStatus">
                        <option value="pending" ${cheque.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="processed" ${cheque.status === 'processed' ? 'selected' : ''}>Processed</option>
                        <option value="deposited" ${cheque.status === 'deposited' ? 'selected' : ''}>Deposited</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn secondary" onclick="chequeManager.closeModals()">Cancel</button>
                    <button type="submit" class="btn primary">Save Changes</button>
                </div>
            </form>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('editChequeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateCheque(id);
        });
    }
    
    updateCheque(id) {
        const index = this.cheques.findIndex(c => c.id === id);
        if (index === -1) return;
        
        this.cheques[index] = {
            ...this.cheques[index],
            chequeNo: document.getElementById('editChequeNo').value,
            amount: parseFloat(document.getElementById('editAmount').value),
            bankName: document.getElementById('editBankName').value,
            payee: document.getElementById('editPayee').value,
            status: document.getElementById('editStatus').value
        };
        
        this.saveToLocalStorage();
        this.loadChequeList();
        this.updateStats();
        this.closeModals();
        
        this.showNotification('Cheque updated successfully!', 'success');
    }
    
    deleteCheque(id) {
        if (confirm('Are you sure you want to delete this cheque?')) {
            this.cheques = this.cheques.filter(c => c.id !== id);
            this.saveToLocalStorage();
            this.loadChequeList();
            this.updateStats();
            this.showNotification('Cheque deleted successfully!', 'success');
        }
    }
    
    searchCheques(query) {
        const filtered = this.cheques.filter(cheque => 
            cheque.chequeNo.toLowerCase().includes(query.toLowerCase()) ||
            cheque.payee.toLowerCase().includes(query.toLowerCase()) ||
            cheque.bankName.toLowerCase().includes(query.toLowerCase())
        );
        
        const tbody = document.getElementById('chequeTableBody');
        tbody.innerHTML = '';
        
        filtered.forEach(cheque => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cheque.chequeNo}</td>
                <td>${cheque.payee}</td>
                <td>${cheque.bankName}</td>
                <td>${this.formatCurrency(cheque.amount)}</td>
                <td>${this.formatDate(cheque.dateIssued)}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td>
                    <button class="btn small" onclick="chequeManager.viewCheque('${cheque.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn small secondary" onclick="chequeManager.editCheque('${cheque.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn small danger" onclick="chequeManager.deleteCheque('${cheque.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    generateDepositSlip() {
        // Switch to deposit slip tab
        this.switchTab('deposit-slip');
        document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
        document.querySelector('[data-tab="deposit-slip"]').classList.add('active');
        
        // Generate deposit slip content
        this.updateDepositSlip();
    }
    
    updateDepositSlip() {
        const pendingCheques = this.cheques.filter(c => c.status === 'pending');
        const tbody = document.getElementById('depositTableBody');
        tbody.innerHTML = '';
        
        let total = 0;
        
        pendingCheques.forEach(cheque => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cheque.chequeNo}</td>
                <td>${cheque.bankName}</td>
                <td>${cheque.payee}</td>
                <td>${this.formatCurrency(cheque.amount)}</td>
            `;
            tbody.appendChild(row);
            total += cheque.amount;
        });
        
        document.getElementById('depositTotal').textContent = this.formatCurrency(total);
        document.getElementById('slipDate').textContent = new Date().toLocaleDateString();
        
        // Update account info from settings
        if (this.settings.defaultBank) {
            document.getElementById('bankNameSlip').textContent = this.settings.defaultBank;
        }
        if (this.settings.defaultAccount) {
            document.getElementById('accountNumber').textContent = this.settings.defaultAccount;
        }
    }
    
    printDepositSlip() {
        window.print();
    }
    
    saveDepositAsPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add deposit slip content to PDF
        const slipContent = document.querySelector('.deposit-slip-template');
        doc.html(slipContent, {
            callback: function(doc) {
                doc.save('deposit-slip.pdf');
            },
            x: 10,
            y: 10
        });
    }
    
    exportToExcel() {
        const worksheet = XLSX.utils.json_to_sheet(this.cheques.map(cheque => ({
            'Cheque Number': cheque.chequeNo,
            'Amount': cheque.amount,
            'Bank Name': cheque.bankName,
            'Branch': cheque.branch,
            'Payee': cheque.payee,
            'Account Number': cheque.accountNo,
            'Date Issued': cheque.dateIssued,
            'Date to Deposit': cheque.dateDeposited,
            'Status': cheque.status,
            'Notes': cheque.notes
        })));
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cheques');
        
        const fileName = `cheques_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        this.showNotification('Excel file exported successfully!', 'success');
    }
    
    async updateExistingExcel(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get existing data
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const existingData = XLSX.utils.sheet_to_json(worksheet);
                
                // Add new cheques
                const newCheques = this.cheques.filter(cheque => 
                    !existingData.some(row => row['Cheque Number'] === cheque.chequeNo)
                );
                
                newCheques.forEach(cheque => {
                    existingData.push({
                        'Cheque Number': cheque.chequeNo,
                        'Amount': cheque.amount,
                        'Bank Name': cheque.bankName,
                        'Branch': cheque.branch,
                        'Payee': cheque.payee,
                        'Account Number': cheque.accountNo,
                        'Date Issued': cheque.dateIssued,
                        'Date to Deposit': cheque.dateDeposited,
                        'Status': cheque.status,
                        'Notes': cheque.notes
                    });
                });
                
                // Create new worksheet with updated data
                const newWorksheet = XLSX.utils.json_to_sheet(existingData);
                workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;
                
                // Write updated file
                XLSX.writeFile(workbook, file.name);
                
                this.showNotification('Excel file updated successfully!', 'success');
            } catch (error) {
                console.error('Error updating Excel:', error);
                this.showNotification('Error updating Excel file', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    importFromExcel() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const importedData = XLSX.utils.sheet_to_json(worksheet);
                    
                    importedData.forEach(row => {
                        const cheque = {
                            id: Date.now().toString() + Math.random(),
                            chequeNo: row['Cheque Number'] || '',
                            amount: parseFloat(row['Amount']) || 0,
                            bankName: row['Bank Name'] || '',
                            branch: row['Branch'] || '',
                            payee: row['Payee'] || '',
                            accountNo: row['Account Number'] || '',
                            dateIssued: row['Date Issued'] || '',
                            dateDeposited: row['Date to Deposit'] || '',
                            notes: row['Notes'] || '',
                            status: row['Status'] || 'pending',
                            createdAt: new Date().toISOString()
                        };
                        
                        // Check if cheque already exists
                        if (!this.cheques.some(c => c.chequeNo === cheque.chequeNo)) {
                            this.cheques.push(cheque);
                        }
                    });
                    
                    this.saveToLocalStorage();
                    this.loadChequeList();
                    this.updateStats();
                    
                    this.showNotification('Data imported successfully!', 'success');
                } catch (error) {
                    console.error('Error importing Excel:', error);
                    this.showNotification('Error importing Excel file', 'error');
                }
            };
            
            reader.readAsArrayBuffer(file);
        };
        
        input.click();
    }
    
    loadSettings() {
        document.getElementById('defaultBank').value = this.settings.defaultBank;
        document.getElementById('defaultAccount').value = this.settings.defaultAccount;
        document.getElementById('dateFormat').value = this.settings.dateFormat;
        document.getElementById('currency').value = this.settings.currency;
        document.getElementById('ocrLanguage').value = this.settings.ocrLanguage;
        document.getElementById('autoExtract').checked = this.settings.autoExtract;
        document.getElementById('saveImage').checked = this.settings.saveImage;
    }
    
    saveSettings() {
        this.settings = {
            defaultBank: document.getElementById('defaultBank').value,
            defaultAccount: document.getElementById('defaultAccount').value,
            dateFormat: document.getElementById('dateFormat').value,
            currency: document.getElementById('currency').value,
            ocrLanguage: document.getElementById('ocrLanguage').value,
            autoExtract: document.getElementById('autoExtract').checked,
            saveImage: document.getElementById('saveImage').checked
        };
        
        localStorage.setItem('chequeSettings', JSON.stringify(this.settings));
        this.showNotification('Settings saved successfully!', 'success');
    }
    
    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            this.settings = this.getDefaultSettings();
            localStorage.setItem('chequeSettings', JSON.stringify(this.settings));
            this.loadSettings();
            this.showNotification('Settings reset to default!', 'success');
        }
    }
    
    updateStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayCheques = this.cheques.filter(c => c.createdAt.startsWith(today));
        const totalAmount = todayCheques.reduce((sum, c) => sum + c.amount, 0);
        
        document.getElementById('processed-count').textContent = todayCheques.length;
        document.getElementById('total-amount').textContent = this.formatCurrency(totalAmount);
    }
    
    setCurrentDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dateDeposited').value = today;
        document.getElementById('dateIssued').value = today;
    }
    
    formatCurrency(amount) {
        const currencySymbols = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'CAD': 'C$',
            'AUD': 'A$'
        };
        
        const symbol = currencySymbols[this.settings.currency] || '$';
        return `${symbol}${amount.toFixed(2)}`;
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const formats = {
            'mm/dd/yyyy': () => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`,
            'dd/mm/yyyy': () => `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`,
            'yyyy-mm-dd': () => date.toISOString().split('T')[0]
        };
        
        return formats[this.settings.dateFormat] ? formats[this.settings.dateFormat]() : date.toLocaleDateString();
    }
    
    saveToLocalStorage() {
        localStorage.setItem('cheques', JSON.stringify(this.cheques));
    }
    
    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        // Stop camera stream if active
        if (this.currentCameraStream) {
            this.currentCameraStream.getTracks().forEach(track => track.stop());
            this.currentCameraStream = null;
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add to body
        document.body.appendChild(notification);
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            border-radius: 5px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s, slideOutRight 0.3s 2.7s;
        `;
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
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
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .btn.small {
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
        }
    `;
    document.head.appendChild(style);
});