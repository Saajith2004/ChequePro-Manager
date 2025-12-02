# ChequePro Manager

A professional cheque management software built with HTML, CSS, and JavaScript.

## Features

### 1. Cheque Data Entry
- **Image Upload**: Upload cheque images via drag & drop or file selection
- **Camera Capture**: Take photos directly from your device camera
- **OCR Processing**: Extract text from cheque images using Tesseract.js
- **Manual Entry**: Form-based manual data entry with validation

### 2. Data Management
- **Local Storage**: All data stored in browser's local storage
- **CRUD Operations**: Create, Read, Update, Delete cheque records
- **Search & Filter**: Search through cheque records
- **Status Tracking**: Track cheque status (Pending, Processed, Deposited)

### 3. Excel Integration
- **Export to Excel**: Create new Excel files with all cheque data
- **Update Existing**: Append new data to existing Excel files
- **Import Data**: Import cheque data from Excel files

### 4. Deposit Slip Generation
- **Automatic Generation**: Generate deposit slips from pending cheques
- **Print Functionality**: Direct printing of deposit slips
- **PDF Export**: Save deposit slips as PDF files

### 5. User Settings
- **Customizable**: Set default bank, account, date format, currency
- **OCR Configuration**: Configure OCR language and auto-extraction
- **Data Preferences**: Control image saving and other preferences

## Setup Instructions

1. **Clone or Download** the project files
2. **Open** `index.html` in a modern web browser
3. **Allow** camera access when prompted for photo capture
4. **Enable** JavaScript for full functionality

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Dependencies

- **Tesseract.js v4.0.2**: For OCR text extraction
- **SheetJS (xlsx)**: For Excel file operations
- **jsPDF**: For PDF generation
- **Font Awesome 6.4.0**: For icons

## Security Notes

- All data is stored locally in your browser
- No data is sent to external servers
- Camera access is optional and requires user permission

## Usage Tips

1. **For best OCR results**: Ensure good lighting when capturing cheque images
2. **Regular backups**: Export data to Excel for backup purposes
3. **Camera setup**: Use the switch camera button for front/back camera selection
4. **Batch operations**: Use the Excel import/export for bulk operations

## Future Enhancements

Planned features for future releases:
- Cloud synchronization
- Multi-user support
- Advanced cheque fraud detection
- Bank API integration
- Mobile app version

## Support

For issues or feature requests, please create an issue on the repository.