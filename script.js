// Main Application Class - ChequePro Manager with Custom Deposit Slip
class ChequeProManager {
    constructor() {
        // Load data from localStorage
        this.cheques = JSON.parse(localStorage.getItem('cheques') || '[]');
        this.banks = JSON.parse(localStorage.getItem('banks') || JSON.stringify(this.getDefaultBanks()));
        this.settings = JSON.parse(localStorage.getItem('settings') || JSON.stringify(this.getDefaultSettings()));
        this.backupHistory = JSON.parse(localStorage.getItem('backupHistory') || '[]');
        this.manualCheques = []; // For manual entry
        
        // Initialize variables
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedCheques = new Set();
        this.selectedForDeposit = new Set();
        this.currentChequeId = null;
        this.currentFile = null;
        this.depositMode = 'auto'; // 'auto' or 'manual'
        
        // For deposit slip
        this.defaultAccountHolder = "";
        this.defaultAccountNumber = "";
        
        this.init();
    }
    
    getDefaultBanks() {
        return {
            banks: [
                "People's Bank",
                "Bank of Ceylon", 
                "Commercial Bank",
                "HNB",
                "Sampath Bank",
                "DFCC Bank",
                "NDB Bank",
                "Seylan Bank",
                "Pan Asia Bank",
                "Citibank",
                "HSBC",
                "Standard Chartered"
            ],
            branches: {
                "People's Bank": ["Headquarters Branch", "Colombo Main", "Kandy", "Galle", "Negombo", "Kurunegala"],
                "Bank of Ceylon": ["Head Office", "Colombo Fort", "Kandy", "Galle", "Jaffna"],
                "Commercial Bank": ["Colombo City", "Kandy", "Galle", "Negombo", "Ratnapura"],
                "HNB": ["Colombo Main", "Kandy", "Galle", "Kurunegala", "Matara"],
                "Sampath Bank": ["Colombo", "Kandy", "Galle", "Negombo"],
                "DFCC Bank": ["Colombo", "Kandy", "Galle"],
                "NDB Bank": ["Colombo", "Kandy"],
                "Seylan Bank": ["Colombo", "Kandy"],
                "Pan Asia Bank": ["Colombo", "Kandy"],
                "Citibank": ["Colombo"],
                "HSBC": ["Colombo"],
                "Standard Chartered": ["Colombo"]
            }
        };
    }
    
    getDefaultSettings() {
        return {
            companyName: "ChequePro Manager",
            defaultCurrency: "LKR",
            dateFormat: "DD/MM/YYYY",
            notifications: {
                newCheque: true,
                exportReminder: true,
                depositDue: false
            },
            export: {
                defaultType: "full",
                fileNamePattern: "ChequePro_{type}_{date}",
                includeAllFields: true,
                includeAmountWords: true,
                includeNotes: false,
                autoExportSchedule: "never",
                autoMarkExported: true
            },
            depositSlip: {
                bankName: "YOUR BANK NAME",
                accountHolder: "John Doe",
                accountNumber: "6.4.8 6.3.2.1.0.5 / 6.4.9.1.1.1.1.1.1",
                notes: "",
                printDateTime: true,
                printPageNumbers: true,
                printWatermark: false
            },
            lastExport: null,
            lastBackup: null
        };
    }
    
    init() {
        this.setCurrentDate();
        this.setupEventListeners();
        this.loadDashboardData();
        this.loadCheques();
        this.updateExportNotification();
        this.loadBankDropdowns();
        this.loadAccountHolderSettings();
        
        // Set default dates
        const today = new Date();
        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - 30);
        const reportStart = document.getElementById('report-start');
        const reportEnd = document.getElementById('report-end');
        if (reportStart) reportStart.valueAsDate = firstDay;
        if (reportEnd) reportEnd.valueAsDate = new Date();
        
        // Initialize manual cheque entries
        this.initManualChequeEntries();
    }
    
    setCurrentDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const currentDate = document.getElementById('current-date');
        if (currentDate) {
            currentDate.textContent = now.toLocaleDateString('en-US', options);
        }
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
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSettingsTab(tab.dataset.tab);
            });
        });
        
        // Cheque form submission
        const chequeForm = document.getElementById('chequeForm');
        if (chequeForm) {
            chequeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCheque();
            });
        }
        
        // Auto-convert amount to words
        const amountInput = document.getElementById('amount');
        if (amountInput) {
            amountInput.addEventListener('input', () => {
                this.convertAmountToWords();
            });
        }
        
        // Bank dropdown change - update branches
        const bankSelect = document.getElementById('bankName');
        if (bankSelect) {
            bankSelect.addEventListener('change', () => {
                this.updateBranchDropdown();
            });
        }
        
        // Branch dropdown with "Add New" option
        const branchSelect = document.getElementById('branch');
        if (branchSelect) {
            branchSelect.addEventListener('change', (e) => {
                if (e.target.value === 'add_new') {
                    this.showAddBranchModal();
                }
            });
        }
        
        // Deposit mode toggle
        const depositMode = document.getElementById('depositMode');
        if (depositMode) {
            depositMode.addEventListener('change', () => {
                this.toggleDepositMode();
            });
        }
        
        // Account number input for deposit slip
        const accountNumberInput = document.getElementById('depositorAccount');
        if (accountNumberInput) {
            accountNumberInput.addEventListener('input', () => {
                this.updateDepositSlipPreview();
            });
        }
        
        // Account holder input for deposit slip
        const accountHolderInput = document.getElementById('depositorName');
        if (accountHolderInput) {
            accountHolderInput.addEventListener('input', () => {
                this.updateDepositSlipPreview();
            });
        }
        
        // Deposit date change
        const depositDate = document.getElementById('depositDate');
        if (depositDate) {
            depositDate.addEventListener('change', () => {
                this.updateDepositSlipPreview();
            });
        }
        
        // Upload cheque button
        const uploadBtn = document.getElementById('upload-cheque-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                this.showPage('cheque-entry');
            });
        }
        
        // Global search
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => {
                this.searchCheques(e.target.value);
            });
        }
        
        // Restore file input
        const restoreFile = document.getElementById('restoreFile');
        if (restoreFile) {
            restoreFile.addEventListener('change', (e) => {
                this.restoreData(e.target.files[0]);
            });
        }
        
        // Load account holder from settings
        this.loadAccountHolderSettings();
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
            'cheque-entry': 'Add Cheque',
            'cheque-list': 'Cheque List',
            'deposit-slip': 'Deposit Slip',
            'reports': 'Reports',
            'settings': 'Settings'
        };
        
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = titleMap[pageId] || 'Dashboard';
        }
        
        // Refresh data for specific pages
        if (pageId === 'dashboard') {
            this.loadDashboardData();
        } else if (pageId === 'cheque-list') {
            this.loadCheques();
        } else if (pageId === 'reports') {
            this.generateReport();
        } else if (pageId === 'deposit-slip') {
            this.updateDepositSlipPreview();
        } else if (pageId === 'settings') {
            this.loadSettingsData();
        }
    }
    
    showSettingsTab(tabId) {
        // Update active tab
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
        
        // Load data for specific tabs
        if (tabId === 'banks') {
            this.loadBanksManagement();
        } else if (tabId === 'backup') {
            this.loadBackupInfo();
        } else if (tabId === 'deposit') {
            this.loadDepositSlipSettings();
        }
    }
    
    // ==================== BANK & BRANCH MANAGEMENT ====================
    
    loadBankDropdowns() {
        const bankSelect = document.getElementById('bankName');
        const branchBankSelect = document.getElementById('branchBankSelect');
        
        if (bankSelect) {
            // Clear existing options except first
            while (bankSelect.options.length > 1) {
                bankSelect.remove(1);
            }
            
            // Add banks
            this.banks.banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = bank;
                option.textContent = bank;
                bankSelect.appendChild(option);
            });
        }
        
        if (branchBankSelect) {
            // Clear existing options except first
            while (branchBankSelect.options.length > 1) {
                branchBankSelect.remove(1);
            }
            
            // Add banks
            this.banks.banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = bank;
                option.textContent = bank;
                branchBankSelect.appendChild(option);
            });
        }
        
        // Update branch dropdown based on selected bank
        this.updateBranchDropdown();
    }
    
    updateBranchDropdown() {
        const bankSelect = document.getElementById('bankName');
        const branchSelect = document.getElementById('branch');
        
        if (!bankSelect || !branchSelect) return;
        
        const selectedBank = bankSelect.value;
        
        // Clear existing options except first
        while (branchSelect.options.length > 1) {
            branchSelect.remove(1);
        }
        
        if (selectedBank && this.banks.branches[selectedBank]) {
            // Add existing branches
            this.banks.branches[selectedBank].forEach(branch => {
                const option = document.createElement('option');
                option.value = branch;
                option.textContent = branch;
                branchSelect.appendChild(option);
            });
            
            // Add "Add New" option
            const addOption = document.createElement('option');
            addOption.value = 'add_new';
            addOption.textContent = '+ Add New Branch';
            addOption.style.color = '#4361ee';
            addOption.style.fontWeight = 'bold';
            branchSelect.appendChild(addOption);
        }
    }
    
    showAddBranchModal() {
        const bankSelect = document.getElementById('bankName');
        const selectedBank = bankSelect.value;
        
        if (!selectedBank) {
            alert('Please select a bank first');
            const branchSelect = document.getElementById('branch');
            branchSelect.value = '';
            return;
        }
        
        const branchName = prompt(`Enter new branch name for ${selectedBank}:`);
        if (branchName && branchName.trim()) {
            this.addNewBranchToBank(selectedBank, branchName.trim());
        } else {
            const branchSelect = document.getElementById('branch');
            branchSelect.value = '';
        }
    }
    
    addNewBranchToBank(bankName, branchName) {
        if (!this.banks.branches[bankName]) {
            this.banks.branches[bankName] = [];
        }
        
        // Check if branch already exists
        if (this.banks.branches[bankName].includes(branchName)) {
            alert('This branch already exists!');
            return;
        }
        
        // Add new branch
        this.banks.branches[bankName].push(branchName);
        
        // Save to localStorage
        localStorage.setItem('banks', JSON.stringify(this.banks));
        
        // Update dropdown
        this.updateBranchDropdown();
        
        // Select the new branch
        const branchSelect = document.getElementById('branch');
        branchSelect.value = branchName;
        
        alert(`Branch "${branchName}" added to ${bankName}`);
    }
    
    // ==================== AMOUNT TO WORDS CONVERSION ====================
    
    convertAmountToWords() {
        const amountInput = document.getElementById('amount');
        const amountWordsInput = document.getElementById('amountWords');
        
        if (!amountInput || !amountWordsInput) return;
        
        const amount = parseFloat(amountInput.value);
        
        if (isNaN(amount) || amount <= 0) {
            amountWordsInput.value = '';
            return;
        }
        
        // Convert to words
        const words = this.numberToWords(amount);
        amountWordsInput.value = words + ' Only';
    }
    
    numberToWords(num) {
        const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const thousands = ['', 'Thousand', 'Million', 'Billion'];
        
        if (num === 0) return 'Zero';
        
        let words = '';
        let i = 0;
        
        while (num > 0) {
            if (num % 1000 !== 0) {
                words = this.convertHundreds(num % 1000) + thousands[i] + ' ' + words;
            }
            num = Math.floor(num / 1000);
            i++;
        }
        
        return words.trim();
    }
    
    convertHundreds(num) {
        const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        let result = '';
        
        // Hundreds
        if (num >= 100) {
            result += units[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }
        
        // Tens and units
        if (num >= 20) {
            result += tens[Math.floor(num / 10)] + ' ';
            num %= 10;
        } else if (num >= 10) {
            result += teens[num - 10] + ' ';
            num = 0;
        }
        
        // Units
        if (num > 0) {
            result += units[num] + ' ';
        }
        
        return result;
    }
    
    // ==================== CHEQUE MANAGEMENT ====================
    
    saveCheque() {
        // Get form values
        const chequeDate = document.getElementById('chequeDate').value;
        const chequeNumber = document.getElementById('chequeNumber').value.trim();
        const bankName = document.getElementById('bankName').value;
        const branch = document.getElementById('branch').value;
        const bankCode = document.getElementById('bankCode').value.trim();
        const payee = document.getElementById('payee').value.trim();
        const accountHolder = document.getElementById('accountHolder').value.trim();
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const amount = parseFloat(document.getElementById('amount').value) || 0;
        const amountWords = document.getElementById('amountWords').value.trim();
        const status = document.getElementById('status').value;
        const notes = document.getElementById('notes').value.trim();
        
        // Validation
        if (!chequeDate || !chequeNumber || !bankName || !branch || !payee || amount <= 0) {
            alert('Please fill in all required fields (marked with *)');
            return;
        }
        
        // Check for duplicate cheque number
        const duplicate = this.cheques.find(c => c.chequeNumber === chequeNumber && c.bankName === bankName);
        if (duplicate) {
            if (!confirm(`Cheque number ${chequeNumber} already exists for ${bankName}. Do you want to continue?`)) {
                return;
            }
        }
        
        // Create cheque object
        const cheque = {
            id: Date.now().toString(),
            chequeDate: chequeDate,
            chequeNumber: chequeNumber,
            bankName: bankName,
            branch: branch,
            bankCode: bankCode,
            payee: payee,
            accountHolder: accountHolder || payee,
            accountNumber: accountNumber,
            amount: amount,
            amountWords: amountWords || this.numberToWords(amount) + ' Only',
            status: status,
            notes: notes,
            exported: false,
            exportDate: null,
            exportType: null,
            addedDate: new Date().toISOString(),
            depositSlipId: null,
            depositedDate: null
        };
        
        // Add to cheques array
        this.cheques.unshift(cheque);
        
        // Save to localStorage
        this.saveToStorage();
        
        // Show success message
        alert(`Cheque ${chequeNumber} saved successfully!`);
        
        // Update dashboard
        this.loadDashboardData();
        
        // Clear form if not "Save & Add Another"
        if (!this.saveAndAddAnotherMode) {
            this.clearForm();
        }
        
        // Go to cheque list
        this.showPage('cheque-list');
    }
    
    saveAndAddAnother() {
        this.saveAndAddAnotherMode = true;
        this.saveCheque();
        this.saveAndAddAnotherMode = false;
        
        // Clear form for next entry
        this.clearForm();
        
        // Focus on cheque number
        document.getElementById('chequeNumber').focus();
    }
    
    clearForm() {
        const form = document.getElementById('chequeForm');
        if (form) {
            form.reset();
            
            // Set default values
            document.getElementById('chequeDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('status').value = 'pending';
            document.getElementById('amountWords').value = '';
            
            // Reset branch dropdown
            this.updateBranchDropdown();
        }
    }
    
    saveToStorage() {
        localStorage.setItem('cheques', JSON.stringify(this.cheques));
        localStorage.setItem('banks', JSON.stringify(this.banks));
        localStorage.setItem('settings', JSON.stringify(this.settings));
        this.updateExportNotification();
    }
    
    // ==================== DASHBOARD ====================
    
    loadDashboardData() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        // Calculate statistics
        const totalCheques = this.cheques.length;
        const weekCheques = this.cheques.filter(cheque => {
            const chequeDate = new Date(cheque.chequeDate);
            chequeDate.setHours(0, 0, 0, 0);
            return chequeDate >= weekStart;
        }).length;
        
        const pendingCheques = this.cheques.filter(c => c.status === 'pending').length;
        const depositedCheques = this.cheques.filter(c => c.status === 'deposited').length;
        const unexportedCheques = this.cheques.filter(c => !c.exported).length;
        
        const totalAmount = this.cheques.reduce((sum, c) => sum + c.amount, 0);
        const avgAmount = totalCheques > 0 ? totalAmount / totalCheques : 0;
        
        // Update stats cards
        this.updateElement('total-cheques', totalCheques.toString());
        this.updateElement('week-cheques', weekCheques.toString());
        this.updateElement('processed-cheques', depositedCheques.toString());
        this.updateElement('process-rate', totalCheques > 0 ? Math.round((depositedCheques / totalCheques) * 100) + '%' : '0%');
        this.updateElement('pending-deposit', pendingCheques.toString());
        this.updateElement('unexported-cheques', unexportedCheques.toString());
        this.updateElement('total-amount', 'LKR ' + this.formatCurrency(totalAmount));
        this.updateElement('avg-amount', 'LKR ' + this.formatCurrency(avgAmount));
        
        // Update export notification
        const exportNotification = document.getElementById('export-notification-text');
        if (exportNotification) {
            if (unexportedCheques > 0) {
                exportNotification.innerHTML = `<span style="color: #f8961e; font-weight: 600;">${unexportedCheques} cheques ready for export</span>`;
            } else {
                exportNotification.textContent = 'All cheques exported';
            }
        }
        
        // Update filter badges
        this.updateElement('total-count', `Total: ${totalCheques}`);
        this.updateElement('unexported-count', `Unexported: ${unexportedCheques}`);
        this.updateElement('pending-count', `Pending: ${pendingCheques}`);
        
        // Load recent cheques
        this.loadRecentCheques();
        
        // Update notification badge
        this.updateNotificationBadge();
    }
    
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    formatCurrency(amount) {
        return amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    loadRecentCheques() {
        const tbody = document.getElementById('recent-cheques-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        const recentCheques = this.cheques.slice(0, 10);
        
        if (recentCheques.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">No cheques added yet</td>
                </tr>
            `;
            return;
        }
        
        recentCheques.forEach(cheque => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                <td>${cheque.chequeNumber}</td>
                <td>${cheque.bankName}</td>
                <td>${cheque.payee}</td>
                <td>LKR ${this.formatCurrency(cheque.amount)}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td><span class="export-badge ${cheque.exported ? 'exported' : 'not-exported'}">${cheque.exported ? '✓' : '✗'}</span></td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // ==================== CHEQUE LIST ====================
    
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
                    <td colspan="10" class="no-data">No cheques found. Add your first cheque!</td>
                </tr>
            `;
            return;
        }
        
        displayCheques.forEach(cheque => {
            const isSelected = this.selectedCheques.has(cheque.id);
            const isSelectedForDeposit = this.selectedForDeposit.has(cheque.id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           onchange="app.toggleChequeSelection('${cheque.id}', this.checked)">
                </td>
                <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                <td>${cheque.chequeNumber}</td>
                <td>${cheque.bankName}</td>
                <td>${cheque.branch}</td>
                <td>${cheque.payee}</td>
                <td>LKR ${this.formatCurrency(cheque.amount)}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td><span class="export-badge ${cheque.exported ? 'exported' : 'not-exported'}">${cheque.exported ? 'Exported' : 'Not Exported'}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="app.editCheque('${cheque.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="app.deleteCheque('${cheque.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        ${cheque.status !== 'deposited' ? `
                        <button class="btn-icon" onclick="app.selectForDeposit('${cheque.id}')" title="Select for Deposit">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            `;
            
            if (isSelectedForDeposit) {
                row.style.backgroundColor = '#e3f2fd';
            }
            
            tbody.appendChild(row);
        });
        
        this.updatePagination();
        this.updateBulkActions();
    }
    
    toggleChequeSelection(id, isSelected) {
        if (isSelected) {
            this.selectedCheques.add(id);
        } else {
            this.selectedCheques.delete(id);
        }
        this.updateBulkActions();
    }
    
    toggleSelectAll() {
        const selectAll = document.getElementById('select-all');
        if (!selectAll) return;
        
        const isChecked = selectAll.checked;
        const checkboxes = document.querySelectorAll('#cheques-body input[type="checkbox"]');
        
        this.selectedCheques.clear();
        
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = isChecked;
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const cheque = this.cheques[start + index];
            if (cheque && isChecked) {
                this.selectedCheques.add(cheque.id);
            }
        });
        
        this.updateBulkActions();
    }
    
    updateBulkActions() {
        const bulkActions = document.getElementById('bulk-actions');
        const selectedCount = document.getElementById('selected-count');
        
        if (bulkActions && selectedCount) {
            if (this.selectedCheques.size > 0) {
                bulkActions.style.display = 'flex';
                selectedCount.textContent = this.selectedCheques.size;
            } else {
                bulkActions.style.display = 'none';
            }
        }
    }
    
    markSelectedExported() {
        if (this.selectedCheques.size === 0) {
            alert('Please select cheques to mark as exported');
            return;
        }
        
        if (confirm(`Mark ${this.selectedCheques.size} selected cheques as exported?`)) {
            this.cheques.forEach(cheque => {
                if (this.selectedCheques.has(cheque.id)) {
                    cheque.exported = true;
                    cheque.exportDate = new Date().toISOString();
                    cheque.exportType = 'bulk';
                }
            });
            
            this.saveToStorage();
            this.loadCheques(this.currentPage);
            this.loadDashboardData();
            alert('Selected cheques marked as exported');
        }
    }
    
    markAllExported() {
        if (this.cheques.length === 0) {
            alert('No cheques to mark as exported');
            return;
        }
        
        if (confirm('Mark ALL cheques as exported?')) {
            this.cheques.forEach(cheque => {
                cheque.exported = true;
                cheque.exportDate = new Date().toISOString();
                cheque.exportType = 'full';
            });
            
            this.saveToStorage();
            this.loadCheques(this.currentPage);
            this.loadDashboardData();
            alert('All cheques marked as exported');
        }
    }
    
    deleteSelected() {
        if (this.selectedCheques.size === 0) {
            alert('Please select cheques to delete');
            return;
        }
        
        if (confirm(`Delete ${this.selectedCheques.size} selected cheques? This action cannot be undone.`)) {
            this.cheques = this.cheques.filter(cheque => !this.selectedCheques.has(cheque.id));
            this.selectedCheques.clear();
            this.saveToStorage();
            this.loadCheques(this.currentPage);
            this.loadDashboardData();
            alert('Selected cheques deleted');
        }
    }
    
    deleteCheque(id) {
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) return;
        
        if (confirm(`Delete cheque ${cheque.chequeNumber} (${cheque.bankName})?`)) {
            this.cheques = this.cheques.filter(c => c.id !== id);
            this.selectedCheques.delete(id);
            this.selectedForDeposit.delete(id);
            this.saveToStorage();
            this.loadCheques(this.currentPage);
            this.loadDashboardData();
            alert('Cheque deleted');
        }
    }
    
    editCheque(id) {
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) return;
        
        // Go to cheque entry page
        this.showPage('cheque-entry');
        
        // Fill form with cheque data
        document.getElementById('chequeDate').value = cheque.chequeDate;
        document.getElementById('chequeNumber').value = cheque.chequeNumber;
        document.getElementById('bankName').value = cheque.bankName;
        
        // Update branch dropdown and select
        setTimeout(() => {
            document.getElementById('branch').value = cheque.branch;
        }, 100);
        
        document.getElementById('bankCode').value = cheque.bankCode || '';
        document.getElementById('payee').value = cheque.payee;
        document.getElementById('accountHolder').value = cheque.accountHolder || '';
        document.getElementById('accountNumber').value = cheque.accountNumber || '';
        document.getElementById('amount').value = cheque.amount;
        document.getElementById('amountWords').value = cheque.amountWords;
        document.getElementById('status').value = cheque.status;
        document.getElementById('notes').value = cheque.notes || '';
        
        // Store current cheque ID for update
        this.currentChequeId = id;
        
        // Change save button text
        const saveBtn = document.querySelector('#chequeForm button[type="submit"]');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Cheque';
            saveBtn.onclick = (e) => {
                e.preventDefault();
                this.updateCheque(id);
            };
        }
        
        // Add delete button
        const formActions = document.querySelector('.form-actions');
        let deleteBtn = formActions.querySelector('.btn-danger');
        if (!deleteBtn) {
            deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
            deleteBtn.onclick = () => this.deleteCheque(id);
            formActions.appendChild(deleteBtn);
        }
    }
    
    updateCheque(id) {
        // Get form values
        const chequeDate = document.getElementById('chequeDate').value;
        const chequeNumber = document.getElementById('chequeNumber').value.trim();
        const bankName = document.getElementById('bankName').value;
        const branch = document.getElementById('branch').value;
        const bankCode = document.getElementById('bankCode').value.trim();
        const payee = document.getElementById('payee').value.trim();
        const accountHolder = document.getElementById('accountHolder').value.trim();
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const amount = parseFloat(document.getElementById('amount').value) || 0;
        const amountWords = document.getElementById('amountWords').value.trim();
        const status = document.getElementById('status').value;
        const notes = document.getElementById('notes').value.trim();
        
        // Validation
        if (!chequeDate || !chequeNumber || !bankName || !branch || !payee || amount <= 0) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Find and update cheque
        const chequeIndex = this.cheques.findIndex(c => c.id === id);
        if (chequeIndex === -1) return;
        
        this.cheques[chequeIndex] = {
            ...this.cheques[chequeIndex],
            chequeDate: chequeDate,
            chequeNumber: chequeNumber,
            bankName: bankName,
            branch: branch,
            bankCode: bankCode,
            payee: payee,
            accountHolder: accountHolder || payee,
            accountNumber: accountNumber,
            amount: amount,
            amountWords: amountWords || this.numberToWords(amount) + ' Only',
            status: status,
            notes: notes
        };
        
        // Save to storage
        this.saveToStorage();
        
        // Show success message
        alert(`Cheque ${chequeNumber} updated successfully!`);
        
        // Go to cheque list
        this.showPage('cheque-list');
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.cheques.length / this.itemsPerPage);
        
        this.updateElement('current-page', this.currentPage.toString());
        this.updateElement('total-pages', totalPages.toString());
        
        const pageBtns = document.querySelectorAll('.page-btn');
        pageBtns.forEach((btn, index) => {
            btn.disabled = false;
            if (index === 0 && this.currentPage <= 1) {
                btn.disabled = true;
            }
            if (index === 1 && this.currentPage >= totalPages) {
                btn.disabled = true;
            }
        });
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
            query = query || searchInput.value.toLowerCase();
        }
        
        const tbody = document.getElementById('cheques-body');
        if (!tbody) return;
        
        if (!query.trim()) {
            this.loadCheques(1);
            return;
        }
        
        const filtered = this.cheques.filter(cheque =>
            cheque.chequeNumber.toLowerCase().includes(query) ||
            cheque.bankName.toLowerCase().includes(query) ||
            cheque.branch.toLowerCase().includes(query) ||
            cheque.payee.toLowerCase().includes(query) ||
            cheque.accountHolder.toLowerCase().includes(query)
        );
        
        tbody.innerHTML = '';
        
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="no-data">No cheques found matching "${query}"</td>
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
                <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                <td>${cheque.chequeNumber}</td>
                <td>${cheque.bankName}</td>
                <td>${cheque.branch}</td>
                <td>${cheque.payee}</td>
                <td>LKR ${this.formatCurrency(cheque.amount)}</td>
                <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                <td><span class="export-badge ${cheque.exported ? 'exported' : 'not-exported'}">${cheque.exported ? 'Exported' : 'Not Exported'}</span></td>
                <td>
                    <div class="action-buttons">
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
    
    // ==================== DEPOSIT SLIP - MAIN FUNCTIONALITY ====================
    
    selectForDeposit(id) {
        if (this.selectedForDeposit.size >= 6) {
            alert('Maximum 6 cheques allowed per deposit slip');
            return;
        }
        
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) return;
        
        if (cheque.status === 'deposited') {
            alert('This cheque has already been deposited');
            return;
        }
        
        this.selectedForDeposit.add(id);
        this.updateDepositSelection();
        
        // Switch to auto mode if manual was active
        this.depositMode = 'auto';
        document.getElementById('depositMode').value = 'auto';
        this.toggleDepositMode();
        
        // Go to deposit slip page
        this.showPage('deposit-slip');
    }
    
    updateDepositSelection() {
        const selectedContainer = document.getElementById('selected-cheques');
        const selectedCount = document.getElementById('selected-count');
        const selectedAmount = document.getElementById('selected-amount');
        
        if (!selectedContainer || !selectedCount || !selectedAmount) return;
        
        const selectedCheques = Array.from(this.selectedForDeposit)
            .map(id => this.cheques.find(c => c.id === id))
            .filter(Boolean);
        
        // Update counts
        selectedCount.textContent = `${selectedCheques.length}/6`;
        
        // Calculate total amount
        const totalAmount = selectedCheques.reduce((sum, c) => sum + c.amount, 0);
        selectedAmount.textContent = 'LKR ' + this.formatCurrency(totalAmount);
        
        // Update selected list
        if (selectedCheques.length === 0) {
            selectedContainer.innerHTML = `
                <div class="no-selection">
                    <i class="fas fa-receipt"></i>
                    <p>No cheques selected</p>
                    <small>Select cheques from list or use manual entry</small>
                </div>
            `;
        } else {
            selectedContainer.innerHTML = selectedCheques.map(cheque => `
                <div class="selected-item">
                    <div>
                        <strong>${cheque.chequeNumber}</strong>
                        <small>${cheque.bankName} - ${cheque.branch}</small>
                    </div>
                    <div class="selected-info">
                        <span>LKR ${this.formatCurrency(cheque.amount)}</span>
                        <button class="btn-icon" onclick="app.removeFromDeposit('${cheque.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        // Update deposit slip preview
        this.updateDepositSlipPreview();
    }
    
    removeFromDeposit(id) {
        this.selectedForDeposit.delete(id);
        this.updateDepositSelection();
        
        // Update cheque list highlighting
        this.loadCheques(this.currentPage);
    }
    
    clearSelected() {
        this.selectedForDeposit.clear();
        this.manualCheques = [];
        this.updateDepositSelection();
        this.initManualChequeEntries();
        
        // Update cheque list highlighting
        this.loadCheques(this.currentPage);
    }
    
    // ==================== DEPOSIT SLIP - CUSTOM FORMAT ====================
    
    updateDepositSlipPreview() {
        if (this.depositMode === 'manual') {
            this.updateManualDepositSlip();
        } else {
            this.updateAutoDepositSlip();
        }
    }
    
    updateAutoDepositSlip() {
        const selectedCheques = Array.from(this.selectedForDeposit)
            .map(id => this.cheques.find(c => c.id === id))
            .filter(Boolean);
        
        // Update slip header
        const bankName = document.querySelector('.bank-name');
        if (bankName) {
            bankName.textContent = this.settings.depositSlip.bankName;
        }
        
        // Update date
        const depositDate = document.getElementById('depositDate');
        const slipDate = document.getElementById('slip-date');
        if (depositDate && slipDate) {
            const date = new Date(depositDate.value);
            slipDate.textContent = date.toLocaleDateString('en-GB');
        }
        
        // Update account holder
        const accountHolder = document.getElementById('depositorName');
        const holderName = document.getElementById('holder-name');
        if (accountHolder && holderName) {
            holderName.textContent = accountHolder.value || "____________________";
        }
        
        // Update account number
        const accountNumber = document.getElementById('depositorAccount');
        const accountDisplay = document.getElementById('account-display');
        if (accountNumber && accountDisplay) {
            accountDisplay.textContent = accountNumber.value || "____________________";
        }
        
        // Update account number boxes
        this.updateAccountNumberBoxes();
        
        // Calculate total amount
        const totalAmount = selectedCheques.reduce((sum, c) => sum + c.amount, 0);
        
        // Update amount in words
        const amountWords = document.getElementById('amount-words');
        if (amountWords) {
            amountWords.textContent = this.numberToWords(totalAmount) + ' Only';
        }
        
        // Update amount in numbers
        const amountNumbers = document.getElementById('amount-numbers');
        if (amountNumbers) {
            amountNumbers.textContent = 'LKR ' + this.formatCurrency(totalAmount);
        }
        
        // Update cheque table
        const slipChequeBody = document.getElementById('slip-cheque-body');
        if (slipChequeBody) {
            slipChequeBody.innerHTML = '';
            
            // Add selected cheques
            selectedCheques.forEach((cheque, index) => {
                if (index < 6) { // Max 6 cheques
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${cheque.chequeNumber}</td>
                        <td>${cheque.bankCode || ''}</td>
                        <td>${cheque.payee}</td>
                        <td>LKR ${this.formatCurrency(cheque.amount)}</td>
                    `;
                    slipChequeBody.appendChild(row);
                }
            });
            
            // Add empty rows if less than 6
            for (let i = selectedCheques.length; i < 6; i++) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>________</td>
                    <td>________</td>
                    <td>____________________</td>
                    <td>________</td>
                `;
                slipChequeBody.appendChild(row);
            }
        }
        
        // Update total
        const totalDisplay = document.getElementById('total-amount-display');
        if (totalDisplay) {
            totalDisplay.textContent = 'LKR ' + this.formatCurrency(totalAmount);
        }
        
        // Update print time
        const printTime = document.getElementById('print-time');
        if (printTime) {
            const now = new Date();
            printTime.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        }
    }
    
    updateManualDepositSlip() {
        // Update slip header
        const bankName = document.querySelector('.bank-name');
        if (bankName) {
            bankName.textContent = this.settings.depositSlip.bankName;
        }
        
        // Update date
        const depositDate = document.getElementById('depositDate');
        const slipDate = document.getElementById('slip-date');
        if (depositDate && slipDate) {
            const date = new Date(depositDate.value);
            slipDate.textContent = date.toLocaleDateString('en-GB');
        }
        
        // Update account holder
        const accountHolder = document.getElementById('depositorName');
        const holderName = document.getElementById('holder-name');
        if (accountHolder && holderName) {
            holderName.textContent = accountHolder.value || "____________________";
        }
        
        // Update account number
        const accountNumber = document.getElementById('depositorAccount');
        const accountDisplay = document.getElementById('account-display');
        if (accountNumber && accountDisplay) {
            accountDisplay.textContent = accountNumber.value || "____________________";
        }
        
        // Update account number boxes
        this.updateAccountNumberBoxes();
        
        // Calculate total amount from manual entries
        const totalAmount = this.manualCheques.reduce((sum, c) => sum + c.amount, 0);
        
        // Update amount in words
        const amountWords = document.getElementById('amount-words');
        if (amountWords) {
            amountWords.textContent = this.numberToWords(totalAmount) + ' Only';
        }
        
        // Update amount in numbers
        const amountNumbers = document.getElementById('amount-numbers');
        if (amountNumbers) {
            amountNumbers.textContent = 'LKR ' + this.formatCurrency(totalAmount);
        }
        
        // Update cheque table with manual entries
        const slipChequeBody = document.getElementById('slip-cheque-body');
        if (slipChequeBody) {
            slipChequeBody.innerHTML = '';
            
            // Add manual cheques
            this.manualCheques.forEach((cheque, index) => {
                if (index < 6) { // Max 6 cheques
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${cheque.chequeNumber || '________'}</td>
                        <td>${cheque.bankCode || '________'}</td>
                        <td>${cheque.payee || '____________________'}</td>
                        <td>LKR ${this.formatCurrency(cheque.amount)}</td>
                    `;
                    slipChequeBody.appendChild(row);
                }
            });
            
            // Add empty rows if less than 6
            for (let i = this.manualCheques.length; i < 6; i++) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>________</td>
                    <td>________</td>
                    <td>____________________</td>
                    <td>________</td>
                `;
                slipChequeBody.appendChild(row);
            }
        }
        
        // Update total
        const totalDisplay = document.getElementById('total-amount-display');
        if (totalDisplay) {
            totalDisplay.textContent = 'LKR ' + this.formatCurrency(totalAmount);
        }
        
        // Update print time
        const printTime = document.getElementById('print-time');
        if (printTime) {
            const now = new Date();
            printTime.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        }
    }
    
    updateAccountNumberBoxes() {
        const accountNumber = document.getElementById('depositorAccount').value || '';
        const container = document.getElementById('account-boxes');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        // Create boxes for each character
        for (let i = 0; i < accountNumber.length; i++) {
            const char = accountNumber[i];
            const box = document.createElement('div');
            
            if (char === '.') {
                box.className = 'account-box dot';
                box.textContent = '.';
            } else if (char === ' ') {
                box.className = 'account-box space';
            } else if (char === '/') {
                box.className = 'account-box slash';
                box.textContent = '/';
            } else {
                box.className = 'account-box digit';
                box.textContent = char;
            }
            
            container.appendChild(box);
        }
        
        // If no account number, show empty boxes
        if (accountNumber.length === 0) {
            for (let i = 0; i < 20; i++) {
                const box = document.createElement('div');
                box.className = 'account-box digit';
                box.textContent = '';
                container.appendChild(box);
            }
        }
    }
    
    // ==================== MANUAL ENTRY FUNCTIONALITY ====================
    
    toggleDepositMode() {
        const mode = document.getElementById('depositMode').value;
        this.depositMode = mode;
        
        const manualFields = document.getElementById('manual-entry-fields');
        if (manualFields) {
            if (mode === 'manual') {
                manualFields.style.display = 'block';
                this.clearSelected(); // Clear auto selection
                this.updateDepositSlipPreview();
            } else {
                manualFields.style.display = 'none';
                this.manualCheques = [];
                this.updateDepositSlipPreview();
            }
        }
    }
    
    initManualChequeEntries() {
        const container = document.getElementById('manual-cheque-entries');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Add initial 2 rows
        for (let i = 0; i < 2; i++) {
            this.addManualChequeRow();
        }
    }
    
    addManualChequeRow() {
        const container = document.getElementById('manual-cheque-entries');
        if (!container) return;
        
        if (this.manualCheques.length >= 6) {
            alert('Maximum 6 cheques allowed per deposit slip');
            return;
        }
        
        const index = this.manualCheques.length;
        const row = document.createElement('div');
        row.className = 'manual-cheque-entry';
        row.innerHTML = `
            <div class="manual-entry-field small">
                <input type="text" class="form-control manual-cheque-no" 
                       placeholder="Cheque No" data-index="${index}"
                       oninput="app.updateManualCheque(${index}, 'chequeNumber', this.value)">
            </div>
            <div class="manual-entry-field small">
                <input type="text" class="form-control manual-bank-code" 
                       placeholder="Bank Code" data-index="${index}"
                       oninput="app.updateManualCheque(${index}, 'bankCode', this.value)">
            </div>
            <div class="manual-entry-field">
                <input type="text" class="form-control manual-payee" 
                       placeholder="Payee" data-index="${index}"
                       oninput="app.updateManualCheque(${index}, 'payee', this.value)">
            </div>
            <div class="manual-entry-field small">
                <input type="number" class="form-control manual-amount" step="0.01"
                       placeholder="Amount" data-index="${index}"
                       oninput="app.updateManualCheque(${index}, 'amount', this.value)">
            </div>
            <button class="btn-icon" onclick="app.removeManualCheque(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(row);
        
        // Add empty cheque object
        this.manualCheques.push({
            chequeNumber: '',
            bankCode: '',
            payee: '',
            amount: 0
        });
    }
    
    updateManualCheque(index, field, value) {
        if (index < 0 || index >= this.manualCheques.length) return;
        
        if (field === 'amount') {
            this.manualCheques[index][field] = parseFloat(value) || 0;
        } else {
            this.manualCheques[index][field] = value;
        }
        
        // Update deposit slip preview
        this.updateDepositSlipPreview();
        
        // Update selected amount display
        const totalAmount = this.manualCheques.reduce((sum, c) => sum + c.amount, 0);
        const selectedAmount = document.getElementById('selected-amount');
        if (selectedAmount) {
            selectedAmount.textContent = 'LKR ' + this.formatCurrency(totalAmount);
        }
    }
    
    removeManualCheque(index) {
        if (index < 0 || index >= this.manualCheques.length) return;
        
        this.manualCheques.splice(index, 1);
        
        // Re-render manual entries
        const container = document.getElementById('manual-cheque-entries');
        if (container) {
            container.innerHTML = '';
            this.manualCheques.forEach((cheque, i) => {
                const row = document.createElement('div');
                row.className = 'manual-cheque-entry';
                row.innerHTML = `
                    <div class="manual-entry-field small">
                        <input type="text" class="form-control manual-cheque-no" 
                               value="${cheque.chequeNumber || ''}" placeholder="Cheque No" data-index="${i}"
                               oninput="app.updateManualCheque(${i}, 'chequeNumber', this.value)">
                    </div>
                    <div class="manual-entry-field small">
                        <input type="text" class="form-control manual-bank-code" 
                               value="${cheque.bankCode || ''}" placeholder="Bank Code" data-index="${i}"
                               oninput="app.updateManualCheque(${i}, 'bankCode', this.value)">
                    </div>
                    <div class="manual-entry-field">
                        <input type="text" class="form-control manual-payee" 
                               value="${cheque.payee || ''}" placeholder="Payee" data-index="${i}"
                               oninput="app.updateManualCheque(${i}, 'payee', this.value)">
                    </div>
                    <div class="manual-entry-field small">
                        <input type="number" class="form-control manual-amount" step="0.01"
                               value="${cheque.amount || ''}" placeholder="Amount" data-index="${i}"
                               oninput="app.updateManualCheque(${i}, 'amount', this.value)">
                    </div>
                    <button class="btn-icon" onclick="app.removeManualCheque(${i})">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                container.appendChild(row);
            });
        }
        
        this.updateDepositSlipPreview();
    }
    
    addManualCheque() {
        this.addManualChequeRow();
    }
    
    // ==================== PRINT FUNCTIONALITY ====================
    
    printDepositSlip() {
        const selectedCheques = this.depositMode === 'manual' 
            ? this.manualCheques 
            : Array.from(this.selectedForDeposit).map(id => this.cheques.find(c => c.id === id)).filter(Boolean);
        
        if (selectedCheques.length === 0) {
            alert('Please add cheques to the deposit slip first');
            return;
        }
        
        const totalAmount = selectedCheques.reduce((sum, c) => sum + c.amount, 0);
        
        if (confirm(`Print deposit slip with ${selectedCheques.length} cheque(s) totaling LKR ${this.formatCurrency(totalAmount)}?`)) {
            // Mark cheques as deposited if in auto mode
            if (this.depositMode === 'auto') {
                const markAsDeposited = confirm('Mark selected cheques as deposited?');
                if (markAsDeposited) {
                    selectedCheques.forEach(cheque => {
                        if (cheque.id) { // Only if it's from saved cheques
                            const savedCheque = this.cheques.find(c => c.id === cheque.id);
                            if (savedCheque) {
                                savedCheque.status = 'deposited';
                                savedCheque.depositedDate = new Date().toISOString();
                            }
                        }
                    });
                    this.saveToStorage();
                    this.loadDashboardData();
                }
                
                // Clear selection
                this.selectedForDeposit.clear();
                this.updateDepositSelection();
            } else {
                // Clear manual entries after printing
                this.manualCheques = [];
                this.initManualChequeEntries();
            }
            
            // Print the slip
            const printWindow = window.open('', '_blank');
            const slipContent = document.getElementById('depositSlip').outerHTML;
            
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Deposit Slip</title>
                    <style>
                        body { 
                            font-family: 'Courier New', monospace; 
                            margin: 0; 
                            padding: 20px;
                        }
                        .deposit-slip {
                            border: 2px solid #000;
                            padding: 25px;
                            min-height: 500px;
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        @media print {
                            body { padding: 0; }
                            .deposit-slip { border: none; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="deposit-slip">
                        ${slipContent}
                    </div>
                    <div class="no-print" style="text-align: center; margin-top: 20px;">
                        <button onclick="window.print()">Print</button>
                        <button onclick="window.close()">Close</button>
                    </div>
                </body>
                </html>
            `);
            
            printWindow.document.close();
            printWindow.focus();
            
            // Auto-print after a short delay
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
    }
    
    saveDepositSlipPDF() {
        alert('PDF export would be implemented here. In a real implementation, you would use jsPDF library.');
    }
    
    refreshSlipPreview() {
        this.updateDepositSlipPreview();
        alert('Deposit slip preview refreshed');
    }
    
    resetSlip() {
        if (confirm('Reset the deposit slip? This will clear all selected cheques and manual entries.')) {
            this.clearSelected();
            this.updateDepositSlipPreview();
            alert('Deposit slip reset');
        }
    }
    
    // ==================== ACCOUNT HOLDER SETTINGS ====================
    
    loadAccountHolderSettings() {
        // Load from settings
        this.defaultAccountHolder = this.settings.depositSlip.accountHolder || "";
        this.defaultAccountNumber = this.settings.depositSlip.accountNumber || "";
        
        // Update deposit slip preview
        this.updateDepositSlipPreview();
    }
    
    loadDepositSlipSettings() {
        document.getElementById('slipBankName').value = this.settings.depositSlip.bankName;
        document.getElementById('defaultAccountHolder').value = this.settings.depositSlip.accountHolder;
        document.getElementById('defaultAccountNumber').value = this.settings.depositSlip.accountNumber;
        document.getElementById('slipNotes').value = this.settings.depositSlip.notes;
        document.getElementById('printDateTime').checked = this.settings.depositSlip.printDateTime;
        document.getElementById('printPageNumbers').checked = this.settings.depositSlip.printPageNumbers;
        document.getElementById('printWatermark').checked = this.settings.depositSlip.printWatermark;
    }
    
    saveDepositSlipSettings() {
        this.settings.depositSlip.bankName = document.getElementById('slipBankName').value;
        this.settings.depositSlip.accountHolder = document.getElementById('defaultAccountHolder').value;
        this.settings.depositSlip.accountNumber = document.getElementById('defaultAccountNumber').value;
        this.settings.depositSlip.notes = document.getElementById('slipNotes').value;
        this.settings.depositSlip.printDateTime = document.getElementById('printDateTime').checked;
        this.settings.depositSlip.printPageNumbers = document.getElementById('printPageNumbers').checked;
        this.settings.depositSlip.printWatermark = document.getElementById('printWatermark').checked;
        
        localStorage.setItem('settings', JSON.stringify(this.settings));
        
        // Update deposit slip with new settings
        this.updateDepositSlipPreview();
        
        alert('Deposit slip settings saved');
    }
    
    testSlipPrint() {
        const testWindow = window.open('', '_blank');
        testWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Print</title>
                <style>
                    body { font-family: Arial; padding: 20px; }
                    .test-slip { border: 2px dashed #ccc; padding: 20px; margin: 20px; }
                </style>
            </head>
            <body>
                <h1>Test Print Successful</h1>
                <div class="test-slip">
                    <p>Bank: ${this.settings.depositSlip.bankName}</p>
                    <p>Account Holder: ${this.settings.depositSlip.accountHolder}</p>
                    <p>Account Number: ${this.settings.depositSlip.accountNumber}</p>
                    <p>Date: ${new Date().toLocaleDateString()}</p>
                </div>
                <p>If you can see this, printing should work correctly.</p>
                <button onclick="window.print()">Test Print</button>
                <button onclick="window.close()">Close</button>
            </body>
            </html>
        `);
        testWindow.document.close();
    }
    
    // ==================== EXCEL EXPORT ====================
    
    exportFullExcel() {
        if (this.cheques.length === 0) {
            alert('No cheques to export');
            return;
        }
        
        this.showLoading('Generating Excel file...');
        
        try {
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Create data for export
            const exportData = this.cheques.map(cheque => ({
                'Date': new Date(cheque.chequeDate).toLocaleDateString(),
                'Cheque Number': cheque.chequeNumber,
                'Bank Name': cheque.bankName,
                'Bank Branch': cheque.branch,
                'Bank Code': cheque.bankCode || '',
                'Payee': cheque.payee,
                'Account Holder': cheque.accountHolder || cheque.payee,
                'Account Number': cheque.accountNumber || '',
                'Amount (LKR)': cheque.amount,
                'Amount in Words': cheque.amountWords,
                'Status': cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1),
                'Exported': cheque.exported ? 'Yes' : 'No',
                'Export Date': cheque.exportDate ? new Date(cheque.exportDate).toLocaleDateString() : '',
                'Notes': cheque.notes || '',
                'Added Date': new Date(cheque.addedDate).toLocaleDateString(),
                'Deposited Date': cheque.depositedDate ? new Date(cheque.depositedDate).toLocaleDateString() : ''
            }));
            
            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Add header styling
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: 0, c: C });
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "4361ee" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }
            
            // Auto column width
            const wscols = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                let max_width = 10;
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (cell && cell.v) {
                        const cell_length = cell.v.toString().length;
                        if (cell_length > max_width) max_width = cell_length;
                    }
                }
                wscols.push({ wch: Math.min(max_width + 2, 50) });
            }
            ws['!cols'] = wscols;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, "All Cheques");
            
            // Create summary sheet
            this.createSummarySheet(wb);
            
            // Generate file name
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `ChequePro_Full_${dateStr}.xlsx`;
            
            // Save file
            XLSX.writeFile(wb, fileName);
            
            // Mark as exported if setting enabled
            if (this.settings.export.autoMarkExported) {
                this.cheques.forEach(cheque => {
                    cheque.exported = true;
                    cheque.exportDate = new Date().toISOString();
                    cheque.exportType = 'full';
                });
                this.saveToStorage();
                this.updateExportNotification();
            }
            
            // Update settings
            this.settings.lastExport = new Date().toISOString();
            localStorage.setItem('settings', JSON.stringify(this.settings));
            
            alert(`Excel file exported successfully: ${fileName}`);
            
        } catch (error) {
            console.error('Excel export error:', error);
            alert('Error exporting Excel file: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    exportUpdates() {
        const unexportedCheques = this.cheques.filter(c => !c.exported);
        
        if (unexportedCheques.length === 0) {
            alert('No new cheques to export');
            return;
        }
        
        this.showLoading('Generating update file...');
        
        try {
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Create data for export
            const exportData = unexportedCheques.map(cheque => ({
                'Date': new Date(cheque.chequeDate).toLocaleDateString(),
                'Cheque Number': cheque.chequeNumber,
                'Bank Name': cheque.bankName,
                'Bank Branch': cheque.branch,
                'Bank Code': cheque.bankCode || '',
                'Payee': cheque.payee,
                'Account Holder': cheque.accountHolder || cheque.payee,
                'Account Number': cheque.accountNumber || '',
                'Amount (LKR)': cheque.amount,
                'Amount in Words': cheque.amountWords,
                'Status': cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1),
                'Notes': cheque.notes || '',
                'Added Date': new Date(cheque.addedDate).toLocaleDateString()
            }));
            
            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Add header styling
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: 0, c: C });
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "4cc9f0" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }
            
            // Auto column width
            const wscols = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                let max_width = 10;
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (cell && cell.v) {
                        const cell_length = cell.v.toString().length;
                        if (cell_length > max_width) max_width = cell_length;
                    }
                }
                wscols.push({ wch: Math.min(max_width + 2, 50) });
            }
            ws['!cols'] = wscols;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, "New Cheques");
            
            // Generate file name
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `ChequePro_Update_${dateStr}.xlsx`;
            
            // Save file
            XLSX.writeFile(wb, fileName);
            
            // Mark as exported if setting enabled
            if (this.settings.export.autoMarkExported) {
                unexportedCheques.forEach(cheque => {
                    cheque.exported = true;
                    cheque.exportDate = new Date().toISOString();
                    cheque.exportType = 'update';
                });
                this.saveToStorage();
                this.updateExportNotification();
            }
            
            // Update settings
            this.settings.lastExport = new Date().toISOString();
            localStorage.setItem('settings', JSON.stringify(this.settings));
            
            alert(`Update file exported successfully: ${fileName} (${unexportedCheques.length} cheques)`);
            
        } catch (error) {
            console.error('Excel export error:', error);
            alert('Error exporting Excel file: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    exportDateRange() {
        const startDate = document.getElementById('export-start-date')?.value;
        const endDate = document.getElementById('export-end-date')?.value;
        
        if (!startDate || !endDate) {
            alert('Please select date range');
            return;
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const rangeCheques = this.cheques.filter(cheque => {
            const chequeDate = new Date(cheque.chequeDate);
            return chequeDate >= start && chequeDate <= end;
        });
        
        if (rangeCheques.length === 0) {
            alert('No cheques found in selected date range');
            return;
        }
        
        this.showLoading('Generating date range export...');
        
        try {
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Create data for export
            const exportData = rangeCheques.map(cheque => ({
                'Date': new Date(cheque.chequeDate).toLocaleDateString(),
                'Cheque Number': cheque.chequeNumber,
                'Bank Name': cheque.bankName,
                'Bank Branch': cheque.branch,
                'Bank Code': cheque.bankCode || '',
                'Payee': cheque.payee,
                'Account Holder': cheque.accountHolder || cheque.payee,
                'Account Number': cheque.accountNumber || '',
                'Amount (LKR)': cheque.amount,
                'Amount in Words': cheque.amountWords,
                'Status': cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1),
                'Exported': cheque.exported ? 'Yes' : 'No',
                'Notes': cheque.notes || ''
            }));
            
            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Add header styling
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: 0, c: C });
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "7209b7" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }
            
            // Auto column width
            const wscols = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                let max_width = 10;
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (cell && cell.v) {
                        const cell_length = cell.v.toString().length;
                        if (cell_length > max_width) max_width = cell_length;
                    }
                }
                wscols.push({ wch: Math.min(max_width + 2, 50) });
            }
            ws['!cols'] = wscols;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, `Cheques ${startDate} to ${endDate}`);
            
            // Generate file name
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `ChequePro_Range_${dateStr}.xlsx`;
            
            // Save file
            XLSX.writeFile(wb, fileName);
            
            // Update settings
            this.settings.lastExport = new Date().toISOString();
            localStorage.setItem('settings', JSON.stringify(this.settings));
            
            alert(`Date range export successful: ${fileName} (${rangeCheques.length} cheques)`);
            
        } catch (error) {
            console.error('Excel export error:', error);
            alert('Error exporting Excel file: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    createSummarySheet(wb) {
        // Bank-wise summary
        const bankSummary = {};
        this.cheques.forEach(cheque => {
            if (!bankSummary[cheque.bankName]) {
                bankSummary[cheque.bankName] = {
                    count: 0,
                    total: 0,
                    deposited: 0,
                    pending: 0
                };
            }
            
            bankSummary[cheque.bankName].count++;
            bankSummary[cheque.bankName].total += cheque.amount;
            
            if (cheque.status === 'deposited') {
                bankSummary[cheque.bankName].deposited++;
            } else {
                bankSummary[cheque.bankName].pending++;
            }
        });
        
        // Convert to array
        const summaryData = Object.entries(bankSummary).map(([bank, data]) => ({
            'Bank Name': bank,
            'Cheque Count': data.count,
            'Total Amount': data.total,
            'Deposited Cheques': data.deposited,
            'Pending Cheques': data.pending,
            'Average Amount': data.total / data.count
        }));
        
        // Add totals row
        summaryData.push({
            'Bank Name': 'TOTAL',
            'Cheque Count': this.cheques.length,
            'Total Amount': this.cheques.reduce((sum, c) => sum + c.amount, 0),
            'Deposited Cheques': this.cheques.filter(c => c.status === 'deposited').length,
            'Pending Cheques': this.cheques.filter(c => c.status !== 'deposited').length,
            'Average Amount': this.cheques.length > 0 ? this.cheques.reduce((sum, c) => sum + c.amount, 0) / this.cheques.length : 0
        });
        
        // Create summary worksheet
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        
        // Style summary sheet
        const range = XLSX.utils.decode_range(wsSummary['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!wsSummary[address]) continue;
            wsSummary[address].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "f8961e" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }
        
        // Style totals row
        const totalsRow = range.e.r;
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: totalsRow, c: C });
            if (!wsSummary[address]) continue;
            wsSummary[address].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "f0f0f0" } }
            };
        }
        
        // Add to workbook
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    }
    
    updateExportNotification() {
        const unexportedCount = this.cheques.filter(c => !c.exported).length;
        const notification = document.getElementById('export-notification');
        const newChequesCount = document.getElementById('new-cheques-count');
        
        if (notification && newChequesCount) {
            if (unexportedCount > 0) {
                notification.style.display = 'flex';
                newChequesCount.textContent = unexportedCount;
            } else {
                notification.style.display = 'none';
            }
        }
    }
    
    // ==================== REPORTS ====================
    
    generateReport() {
        const startDate = document.getElementById('report-start')?.value;
        const endDate = document.getElementById('report-end')?.value;
        const bankFilter = document.getElementById('report-bank')?.value;
        const statusFilter = document.getElementById('report-status')?.value;
        
        let filteredCheques = this.cheques;
        
        // Apply date filter
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            filteredCheques = filteredCheques.filter(cheque => {
                const chequeDate = new Date(cheque.chequeDate);
                return chequeDate >= start && chequeDate <= end;
            });
        }
        
        // Apply bank filter
        if (bankFilter) {
            filteredCheques = filteredCheques.filter(cheque => cheque.bankName === bankFilter);
        }
        
        // Apply status filter
        if (statusFilter) {
            filteredCheques = filteredCheques.filter(cheque => cheque.status === statusFilter);
        }
        
        // Update report summary
        const totalAmount = filteredCheques.reduce((sum, c) => sum + c.amount, 0);
        const uniqueBanks = [...new Set(filteredCheques.map(c => c.bankName))].length;
        
        let daysDiff = 1;
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        }
        const dailyAverage = totalAmount / daysDiff;
        
        this.updateElement('report-total', 'LKR ' + this.formatCurrency(totalAmount));
        this.updateElement('report-count', filteredCheques.length.toString());
        this.updateElement('report-banks', uniqueBanks.toString());
        this.updateElement('report-daily', 'LKR ' + this.formatCurrency(dailyAverage));
        
        // Update report table
        const tbody = document.getElementById('report-body');
        const tableTotal = document.getElementById('report-table-total');
        
        if (tbody) {
            tbody.innerHTML = '';
            
            if (filteredCheques.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="no-data">No cheques found with selected filters</td>
                    </tr>
                `;
            } else {
                filteredCheques.forEach(cheque => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(cheque.chequeDate).toLocaleDateString()}</td>
                        <td>${cheque.chequeNumber}</td>
                        <td>${cheque.bankName}</td>
                        <td>${cheque.branch}</td>
                        <td>${cheque.payee}</td>
                        <td>LKR ${this.formatCurrency(cheque.amount)}</td>
                        <td><span class="status-badge status-${cheque.status}">${cheque.status}</span></td>
                        <td><span class="export-badge ${cheque.exported ? 'exported' : 'not-exported'}">${cheque.exported ? '✓' : '✗'}</span></td>
                    `;
                    tbody.appendChild(row);
                });
            }
        }
        
        if (tableTotal) {
            tableTotal.textContent = 'LKR ' + this.formatCurrency(totalAmount);
        }
        
        // Update charts
        this.updateCharts(filteredCheques);
    }
    
    updateCharts(cheques) {
        // Bank distribution chart
        const bankChart = document.getElementById('bankChart');
        if (bankChart && cheques.length > 0) {
            const bankData = {};
            cheques.forEach(cheque => {
                if (!bankData[cheque.bankName]) {
                    bankData[cheque.bankName] = 0;
                }
                bankData[cheque.bankName] += cheque.amount;
            });
            
            const ctx = bankChart.getContext('2d');
            new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(bankData),
                    datasets: [{
                        data: Object.values(bankData),
                        backgroundColor: [
                            '#4361ee', '#4cc9f0', '#7209b7', '#f8961e',
                            '#3a0ca3', '#f72585', '#4895ef', '#560bad'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
        
        // Monthly trend chart
        const monthlyChart = document.getElementById('monthlyChart');
        if (monthlyChart && cheques.length > 0) {
            const monthlyData = {};
            cheques.forEach(cheque => {
                const date = new Date(cheque.chequeDate);
                const monthYear = `${date.getMonth()+1}/${date.getFullYear()}`;
                if (!monthlyData[monthYear]) {
                    monthlyData[monthYear] = 0;
                }
                monthlyData[monthYear] += cheque.amount;
            });
            
            const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
                const [aMonth, aYear] = a.split('/').map(Number);
                const [bMonth, bYear] = b.split('/').map(Number);
                return aYear === bYear ? aMonth - bMonth : aYear - bYear;
            });
            
            const ctx = monthlyChart.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedMonths,
                    datasets: [{
                        label: 'Amount (LKR)',
                        data: sortedMonths.map(month => monthlyData[month]),
                        borderColor: '#4361ee',
                        backgroundColor: 'rgba(67, 97, 238, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return 'LKR ' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    
    exportReportExcel() {
        this.exportFullExcel(); // For now, use full export
    }
    
    // ==================== SETTINGS ====================
    
    loadSettingsData() {
        // Load general settings
        document.getElementById('companyName').value = this.settings.companyName;
        document.getElementById('defaultCurrency').value = this.settings.defaultCurrency;
        document.getElementById('dateFormat').value = this.settings.dateFormat;
        document.getElementById('notifyNewCheque').checked = this.settings.notifications.newCheque;
        document.getElementById('notifyExport').checked = this.settings.notifications.exportReminder;
        document.getElementById('notifyDeposit').checked = this.settings.notifications.depositDue;
        
        // Load export settings
        document.getElementById('defaultExportType').value = this.settings.export.defaultType;
        document.getElementById('excelNamePattern').value = this.settings.export.fileNamePattern;
        document.getElementById('exportAllFields').checked = this.settings.export.includeAllFields;
        document.getElementById('exportAmountWords').checked = this.settings.export.includeAmountWords;
        document.getElementById('exportNotes').checked = this.settings.export.includeNotes;
        document.getElementById('autoExportSchedule').value = this.settings.export.autoExportSchedule;
        document.getElementById('autoMarkExported').checked = this.settings.export.autoMarkExported;
    }
    
    loadBanksManagement() {
        const banksList = document.getElementById('banks-list');
        if (!banksList) return;
        
        banksList.innerHTML = '';
        
        this.banks.banks.forEach(bank => {
            const bankItem = document.createElement('div');
            bankItem.className = 'bank-item';
            bankItem.innerHTML = `
                <span>${bank}</span>
                <button class="btn-icon" onclick="app.deleteBank('${bank}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            banksList.appendChild(bankItem);
        });
    }
    
    addNewBank() {
        const newBankName = document.getElementById('newBankName').value.trim();
        
        if (!newBankName) {
            alert('Please enter a bank name');
            return;
        }
        
        if (this.banks.banks.includes(newBankName)) {
            alert('This bank already exists');
            return;
        }
        
        this.banks.banks.push(newBankName);
        this.banks.branches[newBankName] = [];
        
        localStorage.setItem('banks', JSON.stringify(this.banks));
        
        // Clear input
        document.getElementById('newBankName').value = '';
        
        // Reload dropdowns
        this.loadBankDropdowns();
        this.loadBanksManagement();
        
        alert(`Bank "${newBankName}" added successfully`);
    }
    
    deleteBank(bankName) {
        if (!confirm(`Delete bank "${bankName}"? This will also delete all its branches.`)) {
            return;
        }
        
        // Remove from banks array
        this.banks.banks = this.banks.banks.filter(bank => bank !== bankName);
        
        // Remove branches
        delete this.banks.branches[bankName];
        
        // Remove cheques from this bank
        this.cheques = this.cheques.filter(cheque => cheque.bankName !== bankName);
        
        localStorage.setItem('banks', JSON.stringify(this.banks));
        localStorage.setItem('cheques', JSON.stringify(this.cheques));
        
        // Reload everything
        this.loadBankDropdowns();
        this.loadBanksManagement();
        this.loadCheques();
        this.loadDashboardData();
        
        alert(`Bank "${bankName}" deleted`);
    }
    
    loadBranches() {
        const bankSelect = document.getElementById('branchBankSelect');
        const branchesList = document.getElementById('branches-list');
        
        if (!bankSelect || !branchesList) return;
        
        const selectedBank = bankSelect.value;
        branchesList.innerHTML = '';
        
        if (selectedBank && this.banks.branches[selectedBank]) {
            this.banks.branches[selectedBank].forEach(branch => {
                const branchItem = document.createElement('div');
                branchItem.className = 'branch-item';
                branchItem.innerHTML = `
                    <span>${branch}</span>
                    <button class="btn-icon" onclick="app.deleteBranch('${selectedBank}', '${branch}')">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                branchesList.appendChild(branchItem);
            });
        }
    }
    
    addNewBranch() {
        const bankSelect = document.getElementById('branchBankSelect');
        const newBranchName = document.getElementById('newBranchName').value.trim();
        const newBranchCode = document.getElementById('newBranchCode').value.trim();
        
        const selectedBank = bankSelect.value;
        
        if (!selectedBank) {
            alert('Please select a bank first');
            return;
        }
        
        if (!newBranchName) {
            alert('Please enter a branch name');
            return;
        }
        
        if (!this.banks.branches[selectedBank]) {
            this.banks.branches[selectedBank] = [];
        }
        
        if (this.banks.branches[selectedBank].includes(newBranchName)) {
            alert('This branch already exists');
            return;
        }
        
        this.banks.branches[selectedBank].push(newBranchName);
        
        localStorage.setItem('banks', JSON.stringify(this.banks));
        
        // Clear inputs
        document.getElementById('newBranchName').value = '';
        document.getElementById('newBranchCode').value = '';
        
        // Reload branches list
        this.loadBranches();
        
        alert(`Branch "${newBranchName}" added to ${selectedBank}`);
    }
    
    deleteBranch(bankName, branchName) {
        if (!confirm(`Delete branch "${branchName}" from ${bankName}?`)) {
            return;
        }
        
        this.banks.branches[bankName] = this.banks.branches[bankName].filter(branch => branch !== branchName);
        
        // Update cheques with this branch
        this.cheques.forEach(cheque => {
            if (cheque.bankName === bankName && cheque.branch === branchName) {
                cheque.branch = '';
            }
        });
        
        localStorage.setItem('banks', JSON.stringify(this.banks));
        localStorage.setItem('cheques', JSON.stringify(this.cheques));
        
        // Reload
        this.loadBranches();
        this.loadCheques();
        
        alert(`Branch "${branchName}" deleted`);
    }
    
    saveGeneralSettings() {
        const companyName = document.getElementById('companyName').value;
        const defaultCurrency = document.getElementById('defaultCurrency').value;
        const dateFormat = document.getElementById('dateFormat').value;
        
        this.settings.companyName = companyName;
        this.settings.defaultCurrency = defaultCurrency;
        this.settings.dateFormat = dateFormat;
        this.settings.notifications.newCheque = document.getElementById('notifyNewCheque').checked;
        this.settings.notifications.exportReminder = document.getElementById('notifyExport').checked;
        this.settings.notifications.depositDue = document.getElementById('notifyDeposit').checked;
        
        localStorage.setItem('settings', JSON.stringify(this.settings));
        
        alert('General settings saved successfully');
    }
    
    saveExportSettings() {
        this.settings.export.defaultType = document.getElementById('defaultExportType').value;
        this.settings.export.fileNamePattern = document.getElementById('excelNamePattern').value;
        this.settings.export.includeAllFields = document.getElementById('exportAllFields').checked;
        this.settings.export.includeAmountWords = document.getElementById('exportAmountWords').checked;
        this.settings.export.includeNotes = document.getElementById('exportNotes').checked;
        this.settings.export.autoExportSchedule = document.getElementById('autoExportSchedule').value;
        this.settings.export.autoMarkExported = document.getElementById('autoMarkExported').checked;
        
        localStorage.setItem('settings', JSON.stringify(this.settings));
        
        alert('Export settings saved successfully');
    }
    
    testExportFormat() {
        // Create a test export with sample data
        const testData = [{
            'Date': '2025-12-03',
            'Cheque Number': 'TEST001',
            'Bank Name': 'Test Bank',
            'Bank Branch': 'Test Branch',
            'Payee': 'Test Payee',
            'Amount (LKR)': 1000.00,
            'Amount in Words': 'One Thousand Only',
            'Status': 'Pending',
            'Exported': 'No'
        }];
        
        const ws = XLSX.utils.json_to_sheet(testData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Test Export");
        XLSX.writeFile(wb, 'ChequePro_Test_Format.xlsx');
        
        alert('Test export file generated. Check the formatting.');
    }
    
    loadBackupInfo() {
        const chequeCount = this.cheques.length;
        const lastBackup = this.settings.lastBackup;
        const dataSize = JSON.stringify(this.cheques).length / 1024; // KB
        
        this.updateElement('backup-cheque-count', chequeCount.toString());
        this.updateElement('last-backup-date', lastBackup ? new Date(lastBackup).toLocaleDateString() : 'Never');
        this.updateElement('data-size', dataSize.toFixed(2) + ' KB');
    }
    
    backupData() {
        const backupData = {
            cheques: this.cheques,
            banks: this.banks,
            settings: this.settings,
            backupDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `ChequePro_Backup_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        // Update backup history
        this.backupHistory.push({
            date: new Date().toISOString(),
            file: exportFileDefaultName,
            chequeCount: this.cheques.length
        });
        
        localStorage.setItem('backupHistory', JSON.stringify(this.backupHistory));
        
        // Update settings
        this.settings.lastBackup = new Date().toISOString();
        localStorage.setItem('settings', JSON.stringify(this.settings));
        
        this.loadBackupInfo();
        
        alert(`Backup created successfully: ${exportFileDefaultName}`);
    }
    
    restoreData(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backupData = JSON.parse(e.target.result);
                
                if (!backupData.cheques || !backupData.banks || !backupData.settings) {
                    throw new Error('Invalid backup file format');
                }
                
                if (confirm('Restore from backup? This will replace all current data.')) {
                    this.cheques = backupData.cheques;
                    this.banks = backupData.banks;
                    this.settings = backupData.settings;
                    
                    localStorage.setItem('cheques', JSON.stringify(this.cheques));
                    localStorage.setItem('banks', JSON.stringify(this.banks));
                    localStorage.setItem('settings', JSON.stringify(this.settings));
                    
                    // Reload everything
                    this.loadDashboardData();
                    this.loadCheques();
                    this.loadBankDropdowns();
                    this.loadBackupInfo();
                    
                    alert('Data restored successfully from backup');
                }
            } catch (error) {
                console.error('Restore error:', error);
                alert('Error restoring backup: ' + error.message);
            }
        };
        
        reader.readAsText(file);
    }
    
    resetAllData() {
        if (confirm('WARNING: This will delete ALL data including cheques, banks, and settings. This action cannot be undone. Are you sure?')) {
            if (confirm('LAST WARNING: All data will be permanently deleted. Continue?')) {
                localStorage.clear();
                
                // Reset to defaults
                this.cheques = [];
                this.banks = this.getDefaultBanks();
                this.settings = this.getDefaultSettings();
                this.backupHistory = [];
                
                // Save defaults
                this.saveToStorage();
                
                // Reload everything
                this.loadDashboardData();
                this.loadCheques();
                this.loadBankDropdowns();
                this.loadBackupInfo();
                
                alert('All data has been reset to defaults');
            }
        }
    }
    
    // ==================== UTILITIES ====================
    
    updateNotificationBadge() {
        const unexportedCount = this.cheques.filter(c => !c.exported).length;
        const badge = document.querySelector('.badge');
        
        if (badge) {
            if (unexportedCount > 0) {
                badge.textContent = unexportedCount > 9 ? '9+' : unexportedCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
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
        if (overlay) {
            overlay.remove();
        }
    }
    
    openFilterModal() {
        alert('Filter modal would open here');
    }
    
    openExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Update counts
            const unexportedCount = this.cheques.filter(c => !c.exported).length;
            const updateCount = document.getElementById('update-count');
            if (updateCount) {
                updateCount.textContent = `${unexportedCount} new cheques available`;
            }
        }
    }
    
    closeExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    showDateRangeExport() {
        const dateRangeExport = document.getElementById('dateRangeExport');
        if (dateRangeExport) {
            dateRangeExport.style.display = 'block';
        }
    }
    
    openExportSettings() {
        this.showPage('settings');
        this.showSettingsTab('export');
    }
    
    openManualEntryModal() {
        const modal = document.getElementById('manualEntryModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    closeManualEntryModal() {
        const modal = document.getElementById('manualEntryModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    addManualChequeToList() {
        const chequeNumber = document.getElementById('manual-cheque-no').value;
        const bankCode = document.getElementById('manual-bank-code').value;
        const payee = document.getElementById('manual-payee').value;
        const amount = parseFloat(document.getElementById('manual-amount').value) || 0;
        
        if (!chequeNumber || !payee || amount <= 0) {
            alert('Please fill in all required fields');
            return;
        }
        
        if (this.manualCheques.length >= 6) {
            alert('Maximum 6 cheques allowed per deposit slip');
            return;
        }
        
        this.manualCheques.push({
            chequeNumber: chequeNumber,
            bankCode: bankCode,
            payee: payee,
            amount: amount
        });
        
        // Update manual entries display
        this.initManualChequeEntries();
        
        // Switch to manual mode
        this.depositMode = 'manual';
        document.getElementById('depositMode').value = 'manual';
        this.toggleDepositMode();
        
        this.closeManualEntryModal();
        this.updateDepositSlipPreview();
        
        alert('Cheque added to deposit slip');
    }
}

// ==================== GLOBAL FUNCTIONS ====================

// Initialize app
let app;

// Global functions for HTML onclick handlers
function showPage(pageId) {
    if (app) app.showPage(pageId);
}

function exportFullExcel() {
    if (app) app.exportFullExcel();
}

function exportUpdates() {
    if (app) app.exportUpdates();
}

function exportDateRange() {
    if (app) app.exportDateRange();
}

function markAllExported() {
    if (app) app.markAllExported();
}

function markSelectedExported() {
    if (app) app.markSelectedExported();
}

function markSelectedDeposited() {
    if (app) {
        const selectedCheques = Array.from(app.selectedCheques)
            .map(id => app.cheques.find(c => c.id === id))
            .filter(Boolean);
        
        if (selectedCheques.length === 0) {
            alert('Please select cheques to mark as deposited');
            return;
        }
        
        if (confirm(`Mark ${selectedCheques.length} selected cheques as deposited?`)) {
            selectedCheques.forEach(cheque => {
                cheque.status = 'deposited';
                cheque.depositedDate = new Date().toISOString();
            });
            
            app.saveToStorage();
            app.loadCheques(app.currentPage);
            app.loadDashboardData();
            alert('Selected cheques marked as deposited');
        }
    }
}

function deleteSelected() {
    if (app) app.deleteSelected();
}

function toggleSelectAll() {
    if (app) app.toggleSelectAll();
}

function changePage(delta) {
    if (app) app.changePage(delta);
}

function searchCheques() {
    if (app) {
        const input = document.getElementById('search-cheques');
        if (input) app.searchCheques(input.value);
    }
}

function clearForm() {
    if (app) app.clearForm();
}

function saveAndAddAnother() {
    if (app) app.saveAndAddAnother();
}

function processCheque() {
    if (app) app.processCheque();
}

function retakePhoto() {
    if (app) app.retakePhoto();
}

function selectForDeposit(id) {
    if (app) app.selectForDeposit(id);
}

function removeFromDeposit(id) {
    if (app) app.removeFromDeposit(id);
}

function clearSelected() {
    if (app) app.clearSelected();
}

function enableManualEntry() {
    if (app) {
        app.depositMode = 'manual';
        document.getElementById('depositMode').value = 'manual';
        app.toggleDepositMode();
    }
}

function addManualCheque() {
    if (app) app.addManualCheque();
}

function printDepositSlip() {
    if (app) app.printDepositSlip();
}

function saveDepositSlipPDF() {
    if (app) app.saveDepositSlipPDF();
}

function refreshSlipPreview() {
    if (app) app.refreshSlipPreview();
}

function resetSlip() {
    if (app) app.resetSlip();
}

function toggleDepositMode() {
    if (app) app.toggleDepositMode();
}

function generateReport() {
    if (app) app.generateReport();
}

function exportReportExcel() {
    if (app) app.exportReportExcel();
}

function printReport() {
    window.print();
}

function resetReportFilters() {
    const today = new Date();
    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - 30);
    
    document.getElementById('report-start').valueAsDate = firstDay;
    document.getElementById('report-end').valueAsDate = new Date();
    document.getElementById('report-bank').value = '';
    document.getElementById('report-status').value = '';
    
    if (app) app.generateReport();
}

function addNewBank() {
    if (app) app.addNewBank();
}

function loadBranches() {
    if (app) app.loadBranches();
}

function addNewBranch() {
    if (app) app.addNewBranch();
}

function saveGeneralSettings() {
    if (app) app.saveGeneralSettings();
}

function saveExportSettings() {
    if (app) app.saveExportSettings();
}

function saveDepositSlipSettings() {
    if (app) app.saveDepositSlipSettings();
}

function testExportFormat() {
    if (app) app.testExportFormat();
}

function testSlipPrint() {
    if (app) app.testSlipPrint();
}

function backupData() {
    if (app) app.backupData();
}

function resetAllData() {
    if (app) app.resetAllData();
}

function openFilterModal() {
    if (app) app.openFilterModal();
}

function openExportModal() {
    if (app) app.openExportModal();
}

function closeExportModal() {
    if (app) app.closeExportModal();
}

function showDateRangeExport() {
    if (app) app.showDateRangeExport();
}

function openExportSettings() {
    if (app) app.openExportSettings();
}

function exportSummaryReport() {
    alert('Summary report export would be implemented here');
}

function openManualEntryModal() {
    if (app) app.openManualEntryModal();
}

function closeManualEntryModal() {
    if (app) app.closeManualEntryModal();
}

function addManualChequeToList() {
    if (app) app.addManualChequeToList();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    app = new ChequeProManager();
    
    // Set current date in header
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const currentDate = document.getElementById('current-date');
    if (currentDate) {
        currentDate.textContent = now.toLocaleDateString('en-US', options);
    }
    
    // Set default dates in forms
    const today = new Date().toISOString().split('T')[0];
    const chequeDate = document.getElementById('chequeDate');
    const depositDate = document.getElementById('depositDate');
    
    if (chequeDate) chequeDate.value = today;
    if (depositDate) depositDate.value = today;
});