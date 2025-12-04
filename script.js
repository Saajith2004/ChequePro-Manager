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
        
           // Global search
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => {
                this.searchCheques(e.target.value);
            });
        }

        // Cheque list search
        const chequeSearch = document.getElementById('search-cheques');
        if (chequeSearch) {
            chequeSearch.addEventListener('input', (e) => {
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
        
        // Activate clicked tab element safely
        const clickedTab = document.querySelector(`.settings-tab[data-tab="${tabId}"]`);
        if (clickedTab) clickedTab.classList.add('active');
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
        const selectedCount = document.getElementById('selected-count-left');        
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
            // Always show cheque list when searching
        this.showPage('cheque-list');

        const searchInput = document.getElementById('search-cheques');
        if (searchInput && (query === undefined || query === null)) {
            query = searchInput.value;
        }

        query = (query || '').toString().toLowerCase();

        const tbody = document.getElementById('cheques-body');
        if (!tbody) return;

        if (!query.trim()) {
            this.loadCheques(1);
            return;
        }

        const filtered = this.cheques.filter(cheque =>
            (cheque.chequeNumber || '').toLowerCase().includes(query) ||
            (cheque.bankName || '').toLowerCase().includes(query) ||
            (cheque.branch || '').toLowerCase().includes(query) ||
            (cheque.payee || '').toLowerCase().includes(query) ||
            (cheque.accountHolder || '').toLowerCase().includes(query)
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

    /**
     * When user clicks "Select for Deposit" in cheque list.
     * Fills the next available cheque line in the deposit slip form.
     */
    selectForDeposit(id) {
        const cheque = this.cheques.find(c => c.id === id);
        if (!cheque) {
            alert('Cheque not found');
            return;
        }

        // Switch to deposit slip page
        this.showPage('deposit-slip');

        const container = document.getElementById('cheque-input-rows');
        if (!container) return;

        // Ensure at least one row exists
        let rows = Array.from(container.querySelectorAll('.cheque-row'));
        if (rows.length === 0) {
            this.addChequeLine();
            rows = Array.from(container.querySelectorAll('.cheque-row'));
        }

        // Find first empty row (no cheque number)
        let targetRow = rows.find(row => {
            const chequeInput = row.querySelector('.cheque-no');
            return chequeInput && !chequeInput.value.trim();
        });

        // If all existing rows are filled and we still have capacity, add a new one (max 6)
        if (!targetRow) {
            if (rows.length >= 6) {
                alert('Maximum 6 cheques allowed per deposit slip');
                return;
            }
            this.addChequeLine();
            rows = Array.from(container.querySelectorAll('.cheque-row'));
            targetRow = rows[rows.length - 1];
        }

        if (!targetRow) return;

        const chequeNoInput = targetRow.querySelector('.cheque-no');
        const branchCodeInput = targetRow.querySelector('.cheque-branch-code');
        const branchNameInput = targetRow.querySelector('.cheque-branch-name');
        const amountInput = targetRow.querySelector('.cheque-amount');

        if (chequeNoInput) chequeNoInput.value = cheque.chequeNumber || '';
        if (branchCodeInput) branchCodeInput.value = cheque.bankCode || '';
        if (branchNameInput) branchNameInput.value = cheque.branch || cheque.bankName || '';
        if (amountInput) amountInput.value = (cheque.amount != null ? cheque.amount.toFixed(2) : '');

        // Update the slip preview and totals
        this.updateSlipFromForm();
    }

    /**
     * Read all cheque input rows from the deposit form.
     * Returns an array of { chequeNo, branchCode, branchName, amount }.
     */
    getDepositRowsFromDOM() {
        const container = document.getElementById('cheque-input-rows');
        const rows = [];

        if (!container) return rows;

        const rowElements = container.querySelectorAll('.cheque-row');
        rowElements.forEach(rowEl => {
            const chequeNoEl = rowEl.querySelector('.cheque-no');
            const branchCodeEl = rowEl.querySelector('.cheque-branch-code');
            const branchNameEl = rowEl.querySelector('.cheque-branch-name');
            const amountEl = rowEl.querySelector('.cheque-amount');

            const chequeNo = chequeNoEl ? chequeNoEl.value.trim() : '';
            const branchCode = branchCodeEl ? branchCodeEl.value.trim() : '';
            const branchName = branchNameEl ? branchNameEl.value.trim() : '';
            const amount = amountEl ? parseFloat(amountEl.value || '0') || 0 : 0;

            // Ignore completely empty rows
            if (!chequeNo && !branchCode && !branchName && amount === 0) return;

            rows.push({ chequeNo, branchCode, branchName, amount });
        });

        return rows;
    }

    /**
     * Update slip preview from the new deposit form (account + cheques + totals).
     */
    updateSlipFromForm() {
        // --- Account holder section ---
        const holderInput = document.getElementById('ds-account-holder');
        const accountInput = document.getElementById('ds-account-number');
        const dateInput = document.getElementById('ds-date');

        const holder = holderInput ? holderInput.value.trim() : '';
        const accountNumberRaw = accountInput ? accountInput.value : '';
        const dateValue = dateInput ? dateInput.value : '';

        // Account holder on slip
        const slipHolder = document.getElementById('slip-account-holder');
        if (slipHolder) {
            slipHolder.textContent = holder;
        }

        // Account number digits (max 10 digits, continuous; spacing via CSS)
        const accountDigits = accountNumberRaw.replace(/\D/g, '').slice(0, 10);
        const slipAccDigits = document.getElementById('slip-account-number-digits');
        if (slipAccDigits) {
            slipAccDigits.textContent = accountDigits;
        }

        // Date -> DDMMYYYY
        let dateDigits = '';
        if (dateValue && dateValue.includes('-')) {
            const parts = dateValue.split('-'); // [YYYY, MM, DD]
            if (parts.length === 3) {
                dateDigits = parts[2] + parts[1] + parts[0];
            }
        }
        const slipDateDigits = document.getElementById('slip-date-digits');
        if (slipDateDigits) {
            slipDateDigits.textContent = dateDigits;
        }

        // --- Cheque rows ---
        const rows = this.getDepositRowsFromDOM();
        let totalAmount = 0;

        for (let i = 1; i <= 6; i++) {
            const row = rows[i - 1];
            const chequeNoEl = document.getElementById(`slip-cheque-no-${i}`);
            const branchCodeEl = document.getElementById(`slip-branch-code-${i}`);
            const branchNameEl = document.getElementById(`slip-branch-name-${i}`);
            const amountRsEl = document.getElementById(`slip-amount-rs-${i}`);
            const amountCtsEl = document.getElementById(`slip-amount-cts-${i}`);

            if (!row) {
                if (chequeNoEl) chequeNoEl.textContent = '';
                if (branchCodeEl) branchCodeEl.textContent = '';
                if (branchNameEl) branchNameEl.textContent = '';
                if (amountRsEl) amountRsEl.textContent = '';
                if (amountCtsEl) amountCtsEl.textContent = '';
                continue;
            }

            const amount = Number(row.amount || 0);
            totalAmount += amount;

            const rs = Math.floor(amount).toString();
            const cts = Math.round((amount % 1) * 100).toString().padStart(2, '0');

            if (chequeNoEl) chequeNoEl.textContent = row.chequeNo || '';
            if (branchCodeEl) branchCodeEl.textContent = row.branchCode || '';
            if (branchNameEl) branchNameEl.textContent = row.branchName || '';
            if (amountRsEl) amountRsEl.textContent = rs;
            if (amountCtsEl) amountCtsEl.textContent = cts;
        }

        // --- Totals ---
        const totalRs = Math.floor(totalAmount).toString();
        const totalCts = Math.round((totalAmount % 1) * 100).toString().padStart(2, '0');

        // Update slip preview totals
        const slipTotalRs = document.getElementById('slip-total-rs');
        const slipTotalCts = document.getElementById('slip-total-cts');
        if (slipTotalRs) slipTotalRs.textContent = totalRs;
        if (slipTotalCts) slipTotalCts.textContent = totalCts;

        // Update totals in the input section
        const totalRsInput = document.getElementById('ds-total-rs');
        const totalCtsInput = document.getElementById('ds-total-cts');
        if (totalRsInput) totalRsInput.value = totalRs;
        if (totalCtsInput) totalCtsInput.value = totalCts;
    }

    /**
     * Simple wrapper to keep compatibility with older code.
     */
    updateDepositSlipPreview() {
        this.updateSlipFromForm();
    }

    /**
     * Add a new cheque input line in the deposit form (max 6).
     * Only the first row includes labels; subsequent rows do not.
     * Each row includes a delete-row button.
     */
    addChequeLine() {
        const container = document.getElementById('cheque-input-rows');
        if (!container) return;

        const existingRows = container.querySelectorAll('.cheque-row').length;
        if (existingRows >= 6) {
            alert('Maximum 6 cheques allowed per deposit slip');
            return;
        }

        const isFirst = container.querySelectorAll('.cheque-row').length === 0;
        const row = document.createElement('div');
        row.className = 'cheque-row';
        row.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    ${isFirst ? '<label>Cheque No *</label>' : ''}
                    <input type="text" class="form-control cheque-no" placeholder="123456"
                           onkeyup="app.lookupChequeRow(this)">
                </div>
                <div class="form-group">
                    ${isFirst ? '<label>Branch Code *</label>' : ''}
                    <input type="text" class="form-control cheque-branch-code" placeholder="001"
                           oninput="app.updateSlipFromForm()">
                </div>
                <div class="form-group">
                    ${isFirst ? '<label>Branch Name *</label>' : ''}
                    <input type="text" class="form-control cheque-branch-name" placeholder="Colombo"
                           oninput="app.updateSlipFromForm()">
                </div>
                <div class="form-group">
                    ${isFirst ? '<label>Amount *</label>' : ''}
                    <input type="number" class="form-control cheque-amount" placeholder="0.00" step="0.01"
                           oninput="app.updateSlipFromForm()">
                </div>
                <button type="button" class="btn btn-danger delete-row-btn" onclick="app.deleteChequeRow(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    }

    /**
     * Delete a cheque row from the deposit slip form.
     * Ensures only the first row has labels after deletion.
     */
    deleteChequeRow(button) {
        const row = button.closest('.cheque-row');
        if (!row) return;

        row.remove();

        // After removal, ensure FIRST ROW has labels, others do not
        const rows = document.querySelectorAll('#cheque-input-rows .cheque-row');
        rows.forEach((r, index) => {
            const labels = r.querySelectorAll('label');
            if (index === 0) {
                // FIRST ROW – ensure labels exist
                if (labels.length === 0) {
                    const groups = r.querySelectorAll('.form-group');
                    const titles = ['Cheque No *','Branch Code *','Branch Name *','Amount *'];
                    groups.forEach((g, i) => {
                        const label = document.createElement('label');
                        label.textContent = titles[i];
                        g.insertBefore(label, g.firstChild);
                    });
                }
            } else {
                // NON-FIRST ROWS – remove labels
                labels.forEach(label => label.remove());
            }
        });

        app.updateSlipFromForm();
    }

    /**
     * Lookup cheque details when user types cheque number in a row.
     * Auto-fills bank code, branch name, and amount from saved cheques.
     */
    lookupChequeRow(inputElement) {
        if (!inputElement) return;

        const chequeNo = inputElement.value.trim();
        const rowEl = inputElement.closest('.cheque-row');
        if (!rowEl) return;

        if (!chequeNo) {
            // If cleared, just update preview
            this.updateSlipFromForm();
            return;
        }

        const cheque = this.cheques.find(c => c.chequeNumber === chequeNo);
        if (!cheque) {
            // No match, but still update preview (amount may be typed manually)
            this.updateSlipFromForm();
            return;
        }

        const branchCodeInput = rowEl.querySelector('.cheque-branch-code');
        const branchNameInput = rowEl.querySelector('.cheque-branch-name');
        const amountInput = rowEl.querySelector('.cheque-amount');

        if (branchCodeInput) branchCodeInput.value = cheque.bankCode || '';
        if (branchNameInput) branchNameInput.value = cheque.branch || cheque.bankName || '';
        if (amountInput) amountInput.value = (cheque.amount != null ? cheque.amount.toFixed(2) : '');

        this.updateSlipFromForm();
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

        if (typeof XLSX === 'undefined' || !XLSX.utils || !XLSX.writeFile) {
            alert('Excel export is not available. Please make sure the Excel library is loaded.');
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

        if (typeof XLSX === 'undefined' || !XLSX.utils || !XLSX.writeFile) {
            alert('Excel export is not available. Please make sure the Excel library is loaded.');
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

        if (typeof XLSX === 'undefined' || !XLSX.utils || !XLSX.writeFile) {
            alert('Excel export is not available. Please make sure the Excel library is loaded.');
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
                    totalAmount: 0
                };
            }

            bankSummary[cheque.bankName].count += 1;
            bankSummary[cheque.bankName].totalAmount += cheque.amount;
        });

        // Convert summary object into a data array for Excel
        const summaryData = Object.keys(bankSummary).map(bankName => ({
            "Bank Name": bankName,
            "Cheque Count": bankSummary[bankName].count,
            "Total Amount (LKR)": bankSummary[bankName].totalAmount
        }));

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(summaryData);

        // Append summary sheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Summary");
    }

    // ==================== EXCEL IMPORT ====================

    /**
     * Import cheques into the system from an Excel (.xlsx) file.
     * Expected columns:
     * Date, Cheque Number, Bank Name, Bank Branch, Bank Code, Payee, Amount
     */
    importChequesFromExcel(file) {
        if (!file) {
            alert("No file selected.");
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                let importedCount = 0;

                rows.forEach(row => {
                    const chequeNumber = (row["Cheque Number"] || "").toString().trim();
                    const amount = parseFloat(row["Amount"]) || 0;

                    if (!chequeNumber || amount <= 0) return;

                    const cheque = {
                        id: Date.now().toString() + Math.random(),
                        chequeDate: row["Date"]
                            ? new Date(row["Date"]).toISOString().split("T")[0]
                            : "",
                        chequeNumber: chequeNumber,
                        bankName: row["Bank Name"] || "",
                        branch: row["Bank Branch"] || "",
                        bankCode: row["Bank Code"] || "",
                        payee: row["Payee"] || "",
                        accountHolder: row["Payee"] || "",
                        accountNumber: "",
                        amount: amount,
                        amountWords: this.numberToWords(amount) + " Only",
                        status: "pending",
                        notes: "",
                        exported: false,
                        exportDate: null,
                        exportType: null,
                        addedDate: new Date().toISOString(),
                        depositSlipId: null,
                        depositedDate: null
                    };

                    this.cheques.unshift(cheque);
                    importedCount++;
                });

                this.saveToStorage();
                this.loadCheques();
                alert(`Imported ${importedCount} cheques successfully`);

            } catch (err) {
                console.error(err);
                alert("Error reading Excel file. Please check file format.");
            }
        };

        reader.readAsArrayBuffer(file);
    }

    /**
     * Handler for Cheque List page import button.
     * Passes file to main import function.
     */
    importChequesFromExcelList(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.importChequesFromExcel(file);

        // Reset input so same file can be selected again
        event.target.value = "";
    };
}