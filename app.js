// C.A.R.S. Vehicle Report Application
// Main application logic separated from HTML for better maintainability

// Configuration
const CONFIG = {
    API_BASE_URL: '/.netlify/functions', // This now points to your Netlify functions folder
    MAX_RETRIES: 3,
    TIMEOUT: 15000, // Increased timeout for potentially slow AI responses
    DEBOUNCE_DELAY: 300
};

// Application state
const AppState = {
    currentSection: null,
    chatHistory: [],
    isLoading: false,
    error: null
};

// Error handling utility
class ErrorHandler {
    static showError(message, duration = 5000) {
        const errorBoundary = document.getElementById('error-boundary');
        const errorMessage = document.getElementById('error-message');
        
        if (errorBoundary && errorMessage) {
            errorMessage.textContent = message;
            errorBoundary.classList.remove('hidden');
            
            setTimeout(() => {
                this.hideError();
            }, duration);
        }
        
        console.error('Application Error:', message);
    }
    
    static hideError() {
        const errorBoundary = document.getElementById('error-boundary');
        if (errorBoundary) {
            errorBoundary.classList.add('hidden');
        }
    }
    
    static handleApiError(error) {
        let message = 'An unexpected error occurred. Please try again.';
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            message = 'Network error. Please check your connection and try again.';
        } else if (error.status === 401) {
            message = 'Authentication required. Please log in again.';
        } else if (error.status === 403) {
            message = 'Access denied. You don\'t have permission to perform this action.';
        } else if (error.status === 404) {
            message = 'The requested resource was not found.';
        } else if (error.status >= 500) {
            message = 'Server error. Please try again later.';
        }
        
        this.showError(message);
    }
}

// Loading indicator utility
class LoadingIndicator {
    static show(message = 'Processing...') {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            const text = indicator.querySelector('span');
            if (text) text.textContent = message;
            indicator.classList.remove('hidden');
        }
        AppState.isLoading = true;
    }

    static hide() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
        AppState.isLoading = false;
    }
}

// API service
class ApiService {
    static async generateResponse(prompt, sectionData) {
        try {
            LoadingIndicator.show();
            const response = await fetch(`${CONFIG.API_BASE_URL}/get-ai-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, sectionData })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.reply;

        } catch (error) {
            ErrorHandler.handleApiError(error);
            return 'Sorry, I encountered an error while processing your request. Please try again.';
        } finally {
            LoadingIndicator.hide();
        }
    }
}

// Modal management
class ModalManager {
    static openModal(section) {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalContent = document.getElementById('modal-content');
        const modalChatMessages = document.getElementById('modal-chat-messages');
        
        if (!modalOverlay || !modalTitle || !modalContent) {
            ErrorHandler.showError('Modal elements not found');
            return;
        }
        
        const data = ReportData.getSectionData(section);
        if (!data) {
            ErrorHandler.showError('Section data not found');
            return;
        }
        
        AppState.currentSection = section;
        modalTitle.textContent = data.title;
        modalContent.innerHTML = data.content;
        
        if (modalChatMessages) {
            modalChatMessages.innerHTML = '<div class="chat-message bot">Hi! I can help explain anything about this section of your report. What would you like to know?</div>';
        }
        
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        const firstFocusable = modalOverlay.querySelector('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }
    
    static closeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
            document.body.style.overflow = '';
            AppState.currentSection = null;
        }
    }
    
    static openPhotoModal(imageUrl, caption) {
        const photoModalOverlay = document.getElementById('photo-modal-overlay');
        const photoModalImage = document.getElementById('photo-modal-image');
        const photoModalTitle = document.getElementById('photo-modal-title');
        const photoModalCaption = document.getElementById('photo-modal-caption');
        
        if (!photoModalOverlay || !photoModalImage) {
            ErrorHandler.showError('Photo modal elements not found');
            return;
        }
        
        photoModalImage.src = imageUrl;
        photoModalImage.alt = caption;
        if (photoModalTitle) photoModalTitle.textContent = caption;
        if (photoModalCaption) photoModalCaption.textContent = caption;
        
        photoModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    static closePhotoModal() {
        const photoModalOverlay = document.getElementById('photo-modal-overlay');
        if (photoModalOverlay) {
            photoModalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
}

// Chat functionality
class ChatManager {
    static async sendMessage(message, containerId, isModal = false) {
        if (!message.trim()) return;
        
        const container = document.getElementById(containerId);
        if (!container) {
            ErrorHandler.showError('Chat container not found');
            return;
        }
        
        this.appendMessage('user', message, container);
        
        const typingDiv = this.appendMessage('bot', 'Assistant is typing...', container, true);
        
        try {
            let sectionData = null;
            if (isModal && AppState.currentSection) {
                sectionData = ReportData.getSectionData(AppState.currentSection);
            }
            
            const response = await ApiService.generateResponse(message, sectionData);
            
            if (typingDiv && typingDiv.parentNode) {
                typingDiv.parentNode.removeChild(typingDiv);
            }
            
            this.appendMessage('bot', response, container);
            
            if (!isModal) {
                AppState.chatHistory.push({ role: 'user', content: message });
                AppState.chatHistory.push({ role: 'assistant', content: response });
            }
            
        } catch (error) {
            if (typingDiv && typingDiv.parentNode) {
                typingDiv.parentNode.removeChild(typingDiv);
            }
            ErrorHandler.showError('Failed to get response from assistant');
        }
    }
    
    static appendMessage(sender, text, container, isTyping = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', sender);
        
        if (isTyping) {
            messageDiv.classList.add('italic', 'text-gray-500');
        }
        
        messageDiv.textContent = text;
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
        
        return messageDiv;
    }
}

// Report data management with integrated checklist
class ReportData {
    // Vehicle information populated after loading report data
    static vehicleInfo = {
        make: '',
        model: '',
        year: '',
        vin: '',
        mileage: '',
        inspectionDate: '',
        exteriorColor: '',
        interiorColor: '',
        engine: '',
        transmission: ''
    };

    // Integrated checklist data
    // Integrated checklist data loaded from server
    static checklistData = {
        vehicle: '',
        items: []
    };

    // Photo data organized by inspection sections
    static photoData = {};

    static update(data) {
        if (data.vehicleInfo) {
            this.vehicleInfo = { ...this.vehicleInfo, ...data.vehicleInfo };
        }
        if (data.checklistData) {
            this.checklistData = data.checklistData;
        }
        if (data.photoData) {
            this.photoData = data.photoData;
        }
    }
    static getSectionData(section) {
        // Helper function to generate HTML for a list of checklist items
        const generateChecklistHTML = (items) => {
            return items.map(item => {
                // Map 'good' status to 'pass' for styling. Add other mappings if needed.
                const status = item.status === 'good' ? 'pass' : 'attention';
                // Prepare photos if a URL exists
                const photos = item.photoUrl ? [{ url: item.photoUrl, caption: item.name }] : [];
                // Use the existing generator function with the checklist data
                return this.generateStatusItem(item.name, status, item.notes, null, photos);
            }).join('');
        };

        // Helper function to generate HTML for categories matching a prefix (e.g., "Interior:")
        const generateCategorizedHTML = (prefix) => {
            // Get a unique list of categories that match the prefix
            const categories = [...new Set(this.checklistData.items
                .filter(item => item.category.startsWith(prefix))
                .map(item => item.category))];

            // For each unique category, create a titled sub-section
            return categories.map(category => {
                const itemsForCategory = this.checklistData.items.filter(item => item.category === category);
                // Clean up the title for display (e.g., "Interior: Driver's Position" -> "Driver's Position")
                const cleanTitle = category.replace(prefix, '').trim();
                return `
                    <h3 class="text-xl font-bold text-gray-800 mt-6 mb-3 border-b-2 border-gray-200 pb-2">${cleanTitle}</h3>
                    <div class="space-y-2">
                        ${generateChecklistHTML(itemsForCategory)}
                    </div>
                `;
            }).join('');
        };

        // Based on the section link clicked, build the modal content dynamically
        switch (section) {
            case 'vehicle-summary': {
                const summaryItems = this.checklistData.items.filter(item => item.category === "Initial Documentation & Overview");
                const v = this.vehicleInfo;
                return {
                    title: 'Vehicle Summary',
                    content: `
                        <div class="space-y-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
                                <p><strong>Make:</strong> ${v.make || ''}</p>
                                <p><strong>Model:</strong> ${v.model || ''}</p>
                                <p><strong>Year:</strong> ${v.year || ''}</p>
                                <p><strong>VIN:</strong> ${v.vin || ''}</p>
                                <p><strong>Mileage:</strong> ${v.mileage || ''}</p>
                                <p><strong>Exterior Color:</strong> ${v.exteriorColor || ''}</p>
                                <p><strong>Interior Color:</strong> ${v.interiorColor || ''}</p>
                                <p><strong>Engine:</strong> ${v.engine || ''}</p>
                                <p><strong>Transmission:</strong> ${v.transmission || ''}</p>
                                <p><strong>Inspection Date:</strong> ${v.inspectionDate || ''}</p>
                            </div>
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <h4 class="font-bold text-blue-900 mb-2">Vehicle History Notes</h4>
                                <p class="text-blue-800 text-sm">This vehicle shows consistent maintenance records with no major accidents reported. The 20,300 miles are consistent with the vehicle's age and condition. All factory-installed features are present and accounted for.</p>
                            </div>
                            ${this.generatePhotoGrid(this.photoData['vehicle-summary'])}
                            <h3 class="text-xl font-bold text-gray-800 mt-6 mb-3 border-b-2 border-gray-200 pb-2">Initial Documentation & Overview</h3>
                            <div class="space-y-2">${generateChecklistHTML(summaryItems)}</div>
                        </div>
                    `
                };
            }
            case 'interior':
                return {
                    title: 'Interior Inspection',
                    content: generateCategorizedHTML("Interior:")
                };
            case 'exterior':
                 return {
                    title: 'Exterior Inspection',
                    content: generateCategorizedHTML("Exterior:")
                };
            case 'under-car':
                const underCarItems = this.checklistData.items.filter(item => item.category === "Under Vehicle (Ground-Level)");
                return {
                    title: 'Under Car Inspection',
                    content: `<div class="space-y-2">${generateChecklistHTML(underCarItems)}</div>`
                };
            case 'under-hood':
                const underHoodItems = this.checklistData.items.filter(item => item.category === "Engine Bay");
                return {
                    title: 'Under Hood Inspection',
                    content: `<div class="space-y-2">${generateChecklistHTML(underHoodItems)}</div>`
                };
            case 'diagnostics':
                const diagnosticItems = this.checklistData.items.filter(item => item.category === "Final Checks & Diagnostics");
                return {
                    title: 'Diagnostic Test Report',
                    content: `
                        <div class="bg-gray-800 text-white font-mono p-4 rounded-lg mb-4">
                            <p>&gt; Performing OBD-II System Scan...</p>
                            <p>&gt; Connecting to vehicle ECU...</p>
                            <p class="text-green-400">&gt; Connection Successful.</p>
                            <p>&gt; Reading Diagnostic Trouble Codes (DTCs)...</p>
                            <p class="text-green-400">&gt; No DTCs Found. System Clear.</p>
                            <p>&gt; Checking I/M Readiness Monitors...</p>
                            <p class="text-green-400">&gt; All systems ready.</p>
                            <p>&gt; Scan Complete.</p>
                        </div>
                        ${this.generatePhotoGrid(this.photoData['diagnostics'])}
                        <h3 class="text-xl font-bold text-gray-800 mt-6 mb-3 border-b-2 border-gray-200 pb-2">Final Checks & Diagnostics</h3>
                        <div class="space-y-2">${generateChecklistHTML(diagnosticItems)}</div>
                    `
                };
            case 'test-drive':
                const testDriveItems = this.checklistData.items.filter(item => item.category === "Test Drive");
                 return {
                    title: 'Test Drive Evaluation',
                    content: `<div class="space-y-2">${generateChecklistHTML(testDriveItems)}</div>`
                };
            case 'mechanic-recommendations':
                // This section remains static as it's a summary, not raw data.
                return {
                    title: 'Mechanic Recommendations',
                    content: `
                        <div class="space-y-4">
                            ${this.generateRecommendation('Immediate Action', 'Brake Service: Due to the vehicle pulling to the right during braking, a full brake inspection and service is required to ensure safety. This may involve cleaning/lubricating caliper slide pins or replacing components.')}
                            ${this.generateRecommendation('Attention Needed', 'Tires: Current tread depth is 6/32". While still safe, replacement will be needed within the next 10,000-15,000 miles. Monitor for wear.')}
                            ${this.generateRecommendation('Attention Needed', 'Cosmetic Repair: The scuff on the front bumper and curb rash on the wheel are cosmetic. Repair is optional.')}
                            ${this.generateRecommendation('Upcoming Maintenance', 'The vehicle is due for a standard oil change and tire rotation in approximately 2,700 miles based on the manufacturer\'s recommended service interval.')}
                        </div>
                        ${this.generatePhotoGrid(this.photoData['mechanic-recommendations'])}
                    `
                };
            default:
                return null;
        }
    }
    
    static generateStatusItem(title, status, description, details = null, photos = []) {
        const statusClasses = {
            pass: { bg: 'bg-green-100', text: 'text-green-800', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            attention: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
            action: { bg: 'bg-red-100', text: 'text-red-800', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
        };
        
        const s = statusClasses[status] || statusClasses['attention']; // Default to 'attention' if status is unknown
        
        let detailsHtml = '';
        if (details) {
            detailsHtml = `
                <div class="mt-3 p-3 bg-white bg-opacity-50 rounded-lg">
                    <h5 class="font-semibold text-sm mb-2">Detailed Findings:</h5>
                    <div class="text-xs space-y-1">
                        ${details}
                    </div>
                </div>
            `;
        }
        
        let photosHtml = '';
        if (photos && photos.length > 0) {
            photosHtml = `
                <div class="mt-3">
                    <h5 class="font-semibold text-sm mb-2">Photos:</h5>
                    <div class="grid grid-cols-2 gap-2">
                        ${photos.map(photo => `
                            <div class="relative group cursor-pointer photo-grid-item" onclick="ModalManager.openPhotoModal('${photo.url}', '${photo.caption}')">
                                <img src="${photo.url}" alt="${photo.caption}" class="w-full h-24 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors" loading="lazy">
                                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path>
                                    </svg>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="${s.bg} ${s.text} p-4 rounded-lg">
                <div class="flex items-start space-x-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${s.icon}" />
                    </svg>
                    <div class="flex-1">
                        <h4 class="font-bold">${title}</h4>
                        <p class="text-sm">${description}</p>
                        ${detailsHtml}
                        ${photosHtml}
                    </div>
                </div>
            </div>
        `;
    }
    
    static generatePhotoGrid(photos) {
        if (!photos || photos.length === 0) return '';
        
        return `
            <div class="mt-6">
                <h4 class="font-bold text-gray-900 mb-3">Inspection Photos</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    ${photos.map(photo => `
                        <div class="relative group cursor-pointer photo-grid-item" onclick="ModalManager.openPhotoModal('${photo.url}', '${photo.caption}')">
                            <img src="${photo.url}" alt="${photo.caption}" class="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors" loading="lazy">
                            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                                <svg class="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path>
                                </svg>
                            </div>
                            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg">
                                ${photo.caption}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    static generateRecommendation(level, text) {
        const levelClasses = {
            'Immediate Action': { border: 'border-red-500', bg: 'bg-red-50' },
            'Attention Needed': { border: 'border-yellow-500', bg: 'bg-yellow-50' },
            'Upcoming Maintenance': { border: 'border-blue-500', bg: 'bg-blue-50' }
        };
        
        const l = levelClasses[level];
        return `
            <div class="border-l-4 ${l.border} ${l.bg} p-4 rounded-r-lg">
                <h4 class="font-bold text-gray-800">${level}</h4>
                <p class="text-gray-600">${text}</p>
            </div>
        `;
    }
}

// Print functionality
class PrintManager {
    static buildPrintableReport() {
        const printArea = document.getElementById('print-area');
        if (!printArea) return;
        
        const companyInfo = {
            name: 'Colorado Automotive Report & Service LLC',
            email: 'office@autoreportserv.co',
            phone: '303-335-9663'
        };
        
        const inspectorInfo = {
            name: 'Alexander Fox',
            email: 'afox@autoreportserv.co',
            phone: '303-908-9815'
        };
        
        const vehicleInfo = ReportData.vehicleInfo;

        const reportSummary = {
            date: vehicleInfo.inspectionDate || '',
            score: '',
            itemsPassed: '',
            attentionNeeded: '',
            immediateAction: ''
        };
        
        const headerHTML = `
            <div style="margin-bottom:24px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <img src="Logo Correct One.png" alt="${companyInfo.name}" style="width:36px;height:36px;object-fit:contain;"/>
                        <div>
                            <div style="font-size:20px;font-weight:700;color:#111827;">${companyInfo.name}</div>
                            <div style="font-size:12px;color:#6b7280;">${companyInfo.email} • ${companyInfo.phone}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:12px;color:#6b7280;">Inspection Date</div>
                        <div style="font-size:14px;color:#111827;font-weight:600;">${reportSummary.date}</div>
                    </div>
                </div>
                <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
                    <div>
                        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:600;">Inspector</div>
                        <div style="font-size:14px;color:#111827;font-weight:600;">${inspectorInfo.name}</div>
                        <div style="font-size:12px;color:#374151;">${inspectorInfo.email}</div>
                        <div style="font-size:12px;color:#374151;">${inspectorInfo.phone}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:600;">Vehicle</div>
                        <div style="font-size:14px;color:#111827;font-weight:600;">${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}</div>
                        <div style="font-size:12px;color:#374151;">VIN: ${vehicleInfo.vin}</div>
                        <div style="font-size:12px;color:#374151;">Mileage: ${vehicleInfo.mileage}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:600;">Summary</div>
                        <div style="font-size:28px;color:#111827;font-weight:700;">${reportSummary.score} / 10</div>
                        <div style="font-size:12px;color:#374151;">Passed: ${reportSummary.itemsPassed} • Attention: ${reportSummary.attentionNeeded} • Immediate: ${reportSummary.immediateAction}</div>
                    </div>
                </div>
            </div>
        `;
        
        printArea.innerHTML = `<div>${headerHTML}</div>`;
    }
    
    static printReport() {
        this.buildPrintableReport();
        window.print();
    }
}

// Email functionality
class EmailManager {
    static openEmailClient() {
        const vehicleInfo = {
            year: '2022',
            make: 'Honda',
            model: 'OK V EX'
        };
        
        const reportSummary = {
            date: 'August 21, 2025',
            score: 8.5,
            itemsPassed: 42,
            attentionNeeded: 8,
            immediateAction: 2
        };
        
        const companyInfo = {
            name: 'Colorado Automotive Report & Service LLC'
        };
        
        const inspectorInfo = {
            name: 'Alexander Fox',
            email: 'afox@autoreportserv.co',
            phone: '303-908-9815'
        };
        
        const subject = encodeURIComponent(`C.A.R.S. OFFICIAL Report - ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} (${reportSummary.date})`);
        const body = encodeURIComponent(
            `Hello,\n\nPlease find attached your vehicle inspection report from ${companyInfo.name}.\n\nSummary:\n- Overall score: ${reportSummary.score}/10\n- Items Passed: ${reportSummary.itemsPassed}\n- Attention Needed: ${reportSummary.attentionNeeded}\n- Immediate Action: ${reportSummary.immediateAction}\n\nInspector: ${inspectorInfo.name}\nEmail: ${inspectorInfo.email}\nPhone: ${inspectorInfo.phone}\n\nThank you,\n${companyInfo.name}`
        );
        
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
}

// Event handlers with debouncing
class EventHandlers {
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static handleReportLinkClick(e) {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        if (section) {
            ModalManager.openModal(section);
        }
    }
    
    static handleModalClose() {
        ModalManager.closeModal();
    }
    
    static handlePhotoModalClose() {
        ModalManager.closePhotoModal();
    }
    
    static handleChatSubmit = this.debounce(async function() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (message) {
            chatInput.value = '';
            await ChatManager.sendMessage(message, 'chat-messages', false);
        }
    }, CONFIG.DEBOUNCE_DELAY);
    
    static handleModalChatSubmit = this.debounce(async function() {
        const modalChatInput = document.getElementById('modal-chat-input');
        const message = modalChatInput.value.trim();
        
        if (message && AppState.currentSection) {
            modalChatInput.value = '';
            await ChatManager.sendMessage(message, 'modal-chat-messages', true);
        }
    }, CONFIG.DEBOUNCE_DELAY);
    
    static handleExportClick() {
        PrintManager.printReport();
    }
    
    static handleEmailClick() {
        EmailManager.openEmailClient();
    }
    
    static handleKeydown(e) {
        if (e.key === 'Escape') {
            const modalOverlay = document.getElementById('modal-overlay');
            const photoModalOverlay = document.getElementById('photo-modal-overlay');
            
            if (modalOverlay && modalOverlay.classList.contains('active')) {
                ModalManager.closeModal();
            } else if (photoModalOverlay && photoModalOverlay.classList.contains('active')) {
                ModalManager.closePhotoModal();
            }
        }
    }
    
    static handleErrorClose() {
        ErrorHandler.hideError();
    }
}

// Initialize application
class App {
    static async init() {
        try {
            await this.loadReport();
            this.setupEventListeners();
            this.setupAccessibility();
            console.log('C.A.R.S. Vehicle Report Application initialized successfully');
        } catch (error) {
            ErrorHandler.showError('Failed to initialize application');
            console.error('Initialization error:', error);
        }
    }
    
    static setupEventListeners() {
        // Report section links
        document.querySelectorAll('.report-link').forEach(link => {
            link.addEventListener('click', EventHandlers.handleReportLinkClick);
        });
        
        // Modal controls
        const modalCloseBtn = document.getElementById('modal-close');
        const modalOverlay = document.getElementById('modal-overlay');
        const photoModalCloseBtn = document.getElementById('photo-modal-close');
        const photoModalOverlay = document.getElementById('photo-modal-overlay');
        
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', EventHandlers.handleModalClose);
        if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) EventHandlers.handleModalClose();
        });
        
        if (photoModalCloseBtn) photoModalCloseBtn.addEventListener('click', EventHandlers.handlePhotoModalClose);
        if (photoModalOverlay) photoModalOverlay.addEventListener('click', (e) => {
            if (e.target === photoModalOverlay) EventHandlers.handlePhotoModalClose();
        });
        
        // Chat functionality
        const chatSendBtn = document.getElementById('chat-send');
        const chatInput = document.getElementById('chat-input');
        const modalChatSendBtn = document.getElementById('modal-chat-send');
        const modalChatInput = document.getElementById('modal-chat-input');
        
        if (chatSendBtn) chatSendBtn.addEventListener('click', EventHandlers.handleChatSubmit);
        if (chatInput) chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                EventHandlers.handleChatSubmit();
            }
        });
        
        if (modalChatSendBtn) modalChatSendBtn.addEventListener('click', EventHandlers.handleModalChatSubmit);
        if (modalChatInput) modalChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                EventHandlers.handleModalChatSubmit();
            }
        });
        
        // Export and email buttons
        const exportBtn = document.getElementById('export-pdf');
        const emailBtn = document.getElementById('email-report');
        
        if (exportBtn) exportBtn.addEventListener('click', EventHandlers.handleExportClick);
        if (emailBtn) emailBtn.addEventListener('click', EventHandlers.handleEmailClick);
        
        // Global event listeners
        document.addEventListener('keydown', EventHandlers.handleKeydown);
        
        // Error handling
        const errorCloseBtn = document.getElementById('error-close');
        if (errorCloseBtn) errorCloseBtn.addEventListener('click', EventHandlers.handleErrorClose);

        // Make modal manager globally available for inline onclick attributes
        window.ModalManager = ModalManager;
    }

    static updateSummary() {
        const v = ReportData.vehicleInfo;
        const makeModel = `${v.year} ${v.make} ${v.model}`.trim();
        const makeModelEl = document.getElementById('summary-make-model');
        if (makeModelEl) makeModelEl.textContent = makeModel;
        const vinEl = document.getElementById('summary-vin');
        if (vinEl) vinEl.textContent = v.vin || '';
        const mileageEl = document.getElementById('summary-mileage');
        if (mileageEl) mileageEl.textContent = v.mileage || '';
        const dateEl = document.getElementById('summary-date');
        if (dateEl) dateEl.textContent = v.inspectionDate || '';

        const headerModelEl = document.getElementById('header-vehicle-model');
        if (headerModelEl) headerModelEl.textContent = makeModel;
        const headerVinEl = document.getElementById('header-vehicle-vin');
        if (headerVinEl) headerVinEl.textContent = `VIN: ${v.vin || ''}`;
        const headerDateEl = document.getElementById('header-vehicle-date');
        if (headerDateEl) headerDateEl.textContent = `Inspection: ${v.inspectionDate || ''}`;
    }

    static async loadReport() {
        try {
            LoadingIndicator.show('Loading report...');
            const params = new URLSearchParams(window.location.search);
            const vin = params.get('vin') || 'vin123';
            const response = await fetch(`${CONFIG.API_BASE_URL}/get-report?vin=${encodeURIComponent(vin)}`);
            if (!response.ok) throw new Error('Failed to fetch report');
            const data = await response.json();
            ReportData.update(data);
            this.updateSummary();
        } catch (error) {
            ErrorHandler.handleApiError(error);
        } finally {
            LoadingIndicator.hide();
        }
    }

    static setupAccessibility() {
        // Trap focus within the active modal
        document.addEventListener('keydown', (e) => {
            const modal = document.querySelector('.modal-overlay.active');
            if (!modal || e.key !== 'Tab') return;

            const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) { // if shift + tab
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else { // if tab
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        });
    }
}

// Global error handling
window.addEventListener('error', (event) => {
    ErrorHandler.showError('An unexpected error occurred');
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    ErrorHandler.showError('An unexpected error occurred');
    console.error('Unhandled promise rejection:', event.reason);
});

// Initialize app when DOM is ready (skip during tests)
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => App.init());
    } else {
        App.init();
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { EventHandlers };
}
