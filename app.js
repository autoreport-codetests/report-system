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
    static checklistData = {
        vehicle: "YEAR MAKE MODEL - VIN",
        items: [
            // --- 1. Initial Documentation & Overview ---
            { category: "Initial Documentation & Overview", name: "VIN Verification (Multiple Locations)", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Odometer Reading Documented", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Warning Light Check", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Title/Registration Check", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Recall Check (Online)", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Service History Review", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Obvious Exterior Damage", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Obvious Interior Damage", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Signs of Major Modifications", status: "good", notes: "", photoUrl: "" },
            { category: "Initial Documentation & Overview", name: "Initial Condition Photos", status: "good", notes: "", photoUrl: "" },

            // --- 2.1 Driver's Side A-Pillar / Fender / Mirror ---
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "VIN Match (A-Pillar/Dash)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Fender: Paint Condition/Match", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Fender: Dents/Damage/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Fender: Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Mirror: Glass Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Mirror: Housing Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Mirror: Power Function (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Mirror: Signal (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "A-Pillar Trim", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Door Top Seal", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver's A-Pillar/Fender/Mirror", name: "Windshield Edge", status: "good", notes: "", photoUrl: "" },

            // --- 2.2 Front Driver's Quarter ---
            { category: "Exterior: Front Driver's Quarter", name: "Wheel: Condition (Scratches, Bends)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Wheel: Lug Nuts/Bolts", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Tire: Brand/Model Match", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Tire: Size Match (Placard)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Tire: Tread Depth (Inner/Mid/Outer)", status: "good", notes: "Measure: I__ M__ O__ mm", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Tire: Age (DOT Code)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Tire: Condition (Cracks, Bulges)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Tire: Pressure (Check/Adjust)", status: "good", notes: "PSI: __", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Tire: Wear Pattern", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Brake Rotor: Surface", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Brake Rotor: Thickness (Visual Est.)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Brake Pads: Thickness (Visual Est.)", status: "good", notes: "Approx __ mm", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Brake Caliper: Leaks/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Brake Line/Hose: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Suspension: Strut/Shock Leak", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Suspension: Bushing Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Suspension: Ball Joint Play (Visual)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "CV Axle Boot (if FWD/AWD)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Headlight: Lens Clarity", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Headlight: Housing/Seal", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Headlight: Operation (Low/High/Signal)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Fog Light: Condition/Op (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Bumper Corner: Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Bumper Corner: Damage/Scuffs", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Bumper Corner: Sensors (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Wheel Well Liner", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Brake Temp Baseline (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Exterior: Front Driver's Quarter", name: "Wheel Bearing Temp Check (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },

            // --- 2.3 Front End ---
            { category: "Exterior: Front End", name: "Hood Latch Mechanism", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Grille: Condition/Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Front Trim: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Front Bumper: Center Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Front Bumper: Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Front Bumper: Impact Absorber Area", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "License Plate Mount", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Front Sensors/Cameras (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Signs of Front Impact Damage", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Hood Alignment (Front Edge)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Front Emblem Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front End", name: "Windshield Washer Jets", status: "good", notes: "", photoUrl: "" },

            // --- 2.4 Front Passenger Quarter ---
            { category: "Exterior: Front Passenger Quarter", name: "Wheel: Condition (Scratches, Bends)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Wheel: Lug Nuts/Bolts", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Tire: Brand/Model Match", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Tire: Size Match (Placard)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Tire: Tread Depth (Inner/Mid/Outer)", status: "good", notes: "Measure: I__ M__ O__ mm", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Tire: Age (DOT Code)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Tire: Condition (Cracks, Bulges)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Tire: Pressure (Check/Adjust)", status: "good", notes: "PSI: __", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Tire: Wear Pattern", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Brake Rotor: Surface", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Brake Rotor: Thickness (Visual Est.)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Brake Pads: Thickness (Visual Est.)", status: "good", notes: "Approx __ mm", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Brake Caliper: Leaks/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Brake Line/Hose: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Suspension: Strut/Shock Leak", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Suspension: Bushing Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Suspension: Ball Joint Play (Visual)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "CV Axle Boot (if FWD/AWD)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Headlight: Lens Clarity", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Headlight: Housing/Seal", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Headlight: Operation (Low/High/Signal)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Fog Light: Condition/Op (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Bumper Corner: Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Bumper Corner: Damage/Scuffs", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Bumper Corner: Sensors (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Fender: Alignment/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Hood Alignment at Corner", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Wheel Well Liner", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Brake Temp Check (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Exterior: Front Passenger Quarter", name: "Wheel Bearing Temp Check (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },

            // --- 2.5 Passenger Side ---
            { category: "Exterior: Passenger Side", name: "Passenger Mirror: Glass Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Mirror: Housing/Functions", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Door Operation (Front/Rear) Handles/Locks", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Front Door: Panel Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Front Door: Paint/Damage/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Front Door: Window Trim", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Front Door: Weatherstripping", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Rear Door: Panel Alignment (if applicable)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Rear Door: Paint/Damage/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Rear Door: Window Trim", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Rear Door: Weatherstripping", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Rocker Panel/Side Skirt: Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Rocker Panel/Side Skirt: Damage/Corrosion", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Side Glass: Condition (Chips, Scratches)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "Side Trim Pieces: Secure", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Passenger Side", name: "B-Pillar Trim (if applicable)", status: "good", notes: "", photoUrl: "" },

            // --- 2.6 Rear Passenger Quarter ---
            { category: "Exterior: Rear Passenger Quarter", name: "Quarter Panel: Paint/Damage/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Quarter Panel: Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Wheel Well Liner", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Wheel: Condition (Scratches, Bends)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Wheel: Lug Nuts/Bolts", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Tire: Brand/Model Match", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Tire: Size Match (Placard)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Tire: Tread Depth (Inner/Mid/Outer)", status: "good", notes: "Measure: I__ M__ O__ mm", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Tire: Age (DOT Code)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Tire: Condition (Cracks, Bulges)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Tire: Pressure (Check/Adjust)", status: "good", notes: "PSI: __", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Tire: Wear Pattern", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Brake Rotor: Surface", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Brake Rotor: Thickness (Visual Est.)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Brake Pads: Thickness (Visual Est.)", status: "good", notes: "Approx __ mm", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Brake Caliper: Leaks/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Brake Line/Hose: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Suspension: Spring Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Suspension: Shock/Strut Leak", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Suspension: Bushing Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Fuel Door: Alignment/Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Fuel Cap: Seal/Presence", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Brake Temp Check (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Exterior: Rear Passenger Quarter", name: "Wheel Bearing Temp Check (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },

            // --- 2.7 Rear End ---
            { category: "Exterior: Rear End", name: "Trunk/Hatch: Operation/Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Trunk/Hatch: Paint/Damage/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Tail Light (Pass): Operation (Brake/Signal/Running)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Tail Light (Pass): Lens Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Tail Light (Pass): Housing Security", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Tail Light (Driver): Operation (Brake/Signal/Running)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Tail Light (Driver): Lens Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Tail Light (Driver): Housing Security", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Third Brake Light Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Rear Bumper: Condition/Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Rear Bumper: Impact Absorber Area", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Rear Bumper: Sensors/Cameras (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Rear Bumper: Exhaust Cutouts", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "License Plate Area/Light", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Backup Camera Operation (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Rear Emblems/Badges", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Rear Spoiler (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Signs of Rear Impact Damage", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear End", name: "Reverse Lights", status: "good", notes: "", photoUrl: "" },

            // --- 2.8 Rear Driver Quarter ---
            { category: "Exterior: Rear Driver Quarter", name: "Quarter Panel: Paint/Damage/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Quarter Panel: Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Wheel Well Liner", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Wheel: Condition (Scratches, Bends)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Wheel: Lug Nuts/Bolts", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Tire: Brand/Model Match", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Tire: Size Match (Placard)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Tire: Tread Depth (Inner/Mid/Outer)", status: "good", notes: "Measure: I__ M__ O__ mm", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Tire: Age (DOT Code)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Tire: Condition (Cracks, Bulges)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Tire: Pressure (Check/Adjust)", status: "good", notes: "PSI: __", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Tire: Wear Pattern", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Brake Rotor: Surface", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Brake Rotor: Thickness (Visual Est.)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Brake Pads: Thickness (Visual Est.)", status: "good", notes: "Approx __ mm", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Brake Caliper: Leaks/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Brake Line/Hose: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Suspension: Spring Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Suspension: Shock/Strut Leak", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Suspension: Bushing Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Brake Temp Check (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Exterior: Rear Driver Quarter", name: "Wheel Bearing Temp Check (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },

            // --- 2.9 Driver Side ---
            { category: "Exterior: Driver Side", name: "Door Operation (Front/Rear) Handles/Locks", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Rear Door: Panel Alignment (if applicable)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Rear Door: Paint/Damage/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Rear Door: Window Trim", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Rear Door: Weatherstripping", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Front Door: Panel Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Front Door: Paint/Damage/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Front Door: Window Trim", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Front Door: Mirror Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Front Door: Weatherstripping", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Rocker Panel/Side Skirt: Alignment", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Rocker Panel/Side Skirt: Damage/Corrosion", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Side Glass: Condition (Chips, Scratches)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "Side Trim Pieces: Secure", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Driver Side", name: "B-Pillar Trim (if applicable)", status: "good", notes: "", photoUrl: "" },

            // --- 2.10 Roof and Glass ---
            { category: "Exterior: Roof and Glass", name: "Windshield: Chips/Cracks", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Windshield: Pitting/Wiper Marks", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Windshield: Seal Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Wipers: Blade Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Washer System Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Roof Panel: Paint/Dents/Rust", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Sunroof: Glass Condition (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Sunroof: Seal Condition (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Sunroof: Drain Check (Visual, if possible)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Sunroof: Operation (Open/Close/Tilt)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Roof Rails/Rack (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Antenna/Shark Fin", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Rear Window: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Rear Window: Defroster Lines", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "Rear Wiper/Washer (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Exterior: Roof and Glass", name: "All Other Glass: Condition", status: "good", notes: "", photoUrl: "" },

            // --- 3. Under Vehicle (Ground-Level Only) ---
            { category: "Under Vehicle (Ground-Level)", name: "Visible Fluid Leaks (Engine, Trans, Diff, PS, Coolant, Brake)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Hanging/Loose Parts (Exhaust, Shields, Wires)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Obvious Rust/Corrosion (Frame, Subframe, Floor Pans)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Exhaust System (Visible Damage/Leaks/Rust)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Exhaust Hangers/Mounts Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Engine Oil Pan Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Transmission Pan/Case Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Driveshaft/CV Axles (Visual)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Suspension Components (Visual Damage/Leaks)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Steering Components (Visual Leaks/Damage)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Brake Lines/Hoses (Visual Condition)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Fuel Tank/Lines (Visual Condition/Leaks)", status: "good", notes: "", photoUrl: "" },
            { category: "Under Vehicle (Ground-Level)", name: "Underbody Covers (Present/Secure/Damage)", status: "good", notes: "", photoUrl: "" },

            // --- 4.1 Driver's Entry Point ---
            { category: "Interior: Driver's Entry", name: "Door Opening Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Handle Feel (Exterior/Interior)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Hinge Condition/Noise", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Door Stop Function", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Weather Stripping Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Sill Plate Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "B-Pillar Trim Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Seat Belt Attachment Point", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "VIN Sticker Verification", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Door Panel Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Door Trim Secure", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Speaker Covers Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Entry", name: "Storage Compartments", status: "good", notes: "", photoUrl: "" },

            // --- 4.2 Driver's Position ---
            { category: "Interior: Driver's Position", name: "Seat: Upholstery Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Seat: Adjustments (Manual/Power)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Seat: Lumbar Support (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Seat: Heating/Cooling (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Seat: Memory Function (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Seat Belt: Condition/Retraction", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Seat Belt: Latch/Buckle Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Steering Wheel: Condition (Wear)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Steering Wheel: Adjustment (Tilt/Telescope)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Steering Wheel: Controls (Audio/Cruise/etc.)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Steering Wheel: Heating (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Horn Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Pedals: Wear/Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Floor Mats/Carpet Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Driver's Position", name: "Dead Pedal Condition", status: "good", notes: "", photoUrl: "" },

            // --- 4.3 Dashboard & Controls ---
            { category: "Interior: Dashboard & Controls", name: "Dashboard Surface Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Instrument Cluster Clarity", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Warning Lights (Key On/Engine Off)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Warning Lights (Engine Running)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Gauge Function (Speedo, Tach, Fuel, Temp)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Odometer Reading Display", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Trip Computer/Info Display", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Headlight Switch Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Wiper/Washer Stalk Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Turn Signal Stalk Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Ignition Switch/Button Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Hazard Light Switch", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Vent Condition/Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Dashboard & Controls", name: "Initial OBD Scan", status: "good", notes: "Codes:__", photoUrl: "" },

            // --- 4.4 Center Console ---
            { category: "Interior: Center Console", name: "Shifter Operation (P-R-N-D)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Shifter: Manual Mode/Paddles (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Shifter: Boot/Trim Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Entertainment System: Power", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Entertainment System: Screen Condition/Touch", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Entertainment System: Button/Knob Function", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Entertainment System: Audio Output (All Speakers)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Entertainment System: Radio/Media Source Test", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Navigation System Operation (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Climate Controls: Button/Knob Function", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Climate Controls: Display Function", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Climate Controls: Mode Selection (Face/Feet/Defrost)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Climate Controls: Fan Speed Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Climate Controls: A/C Cold Output", status: "good", notes: "Temp:__°F/°C", photoUrl: "" },
            { category: "Interior: Center Console", name: "Climate Controls: Heat Output", status: "good", notes: "Temp:__°F/°C", photoUrl: "" },
            { category: "Interior: Center Console", name: "Climate Controls: Recirculation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Storage Compartments: Operation/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Cup Holders: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "USB/Power Ports: Function", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Emergency Brake: Operation/Hold", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Emergency Brake: Warning Light", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Center Console", name: "Console Trim Condition", status: "good", notes: "", photoUrl: "" },

            // --- 4.5 Passenger Position ---
            { category: "Interior: Passenger Position", name: "Seat: Upholstery Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Seat: Adjustments (Manual/Power)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Seat: Heating/Cooling (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Seat Belt: Condition/Retraction", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Seat Belt: Latch/Buckle Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Airbag Cover Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Airbag Indicators (Passenger On/Off)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Glove Box: Operation/Latch", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Glove Box: Light (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Dashboard Trim Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Door Panel: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Door Handle/Lock Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Window Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Passenger Position", name: "Floor Mats/Carpet Condition", status: "good", notes: "", photoUrl: "" },

            // --- 4.6 Rear Seats - Passenger Side ---
            { category: "Interior: Rear Seats - Passenger", name: "Seat: Upholstery Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Seat: Fold Function (if applicable)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Seat Belt: Condition/Retraction", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Seat Belt: Latch/Buckle Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Headrest: Condition/Adjustment", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Door Panel: Condition (if applicable)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Door Handle/Lock Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Window Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Child Lock Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Trim Pieces: Secure/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Floor Mats/Carpet Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Rear Vent Operation (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Passenger", name: "Rear Power Ports (if equipped)", status: "good", notes: "", photoUrl: "" },

            // --- 4.7 Rear Seats - Center ---
            { category: "Interior: Rear Seats - Center", name: "Seat: Upholstery Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Center", name: "Seat Belt: Condition/Retraction", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Center", name: "Seat Belt: Latch/Buckle Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Center", name: "Center Armrest: Operation (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Center", name: "Cup Holders (Rear)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Center", name: "Pass-Through Operation (if equipped)", status: "good", notes: "", photoUrl: "" },

            // --- 4.8 Rear Seats - Driver Side ---
            { category: "Interior: Rear Seats - Driver", name: "Seat: Upholstery Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Seat: Fold Function (if applicable)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Seat Belt: Condition/Retraction", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Seat Belt: Latch/Buckle Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Headrest: Condition/Adjustment", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Door Panel: Condition (if applicable)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Door Handle/Lock Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Window Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Child Lock Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Trim Pieces: Secure/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Rear Seats - Driver", name: "Floor Mats/Carpet Condition", status: "good", notes: "", photoUrl: "" },

            // --- 4.9 Headliner & Sunroof ---
            { category: "Interior: Headliner & Sunroof", name: "Headliner: Condition (Stains, Sagging)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Headliner & Sunroof", name: "Dome/Map Lights Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Headliner & Sunroof", name: "Grab Handles Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Headliner & Sunroof", name: "Sun Visors: Condition/Mirrors/Lights", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Headliner & Sunroof", name: "Sunroof: Operation (Open/Close/Tilt)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Headliner & Sunroof", name: "Sunroof: Shade Operation (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Headliner & Sunroof", name: "Sunroof: Seal Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Headliner & Sunroof", name: "Sunroof: Drain Check (Visual)", status: "good", notes: "", photoUrl: "" },

            // --- 4.10 Trunk/Cargo Area ---
            { category: "Interior: Trunk/Cargo Area", name: "Trunk/Hatch Release (Interior/Exterior/Key)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Struts/Hinges Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Trim Panels Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Carpet Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Spare Tire: Presence/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Spare Tire: Pressure", status: "good", notes: "PSI: __", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Jack & Tools: Presence/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Cargo Cover: Operation/Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Cargo Net/Tie-downs (if equipped)", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Water Intrusion Signs", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Trunk Light Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Interior: Trunk/Cargo Area", name: "Emergency Trunk Release", status: "good", notes: "", photoUrl: "" },

            // --- 5. Engine Bay Inspection ---
            { category: "Engine Bay", name: "Hood Release/Latch/Struts", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Under Hood Insulation/Structure", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Engine Oil: Level", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Engine Oil: Condition/Color", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Engine Oil: Cap Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Engine Oil: Filler Neck (Sludge)", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Coolant: Level (Reservoir)", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Coolant: Condition/Color", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Coolant: Cap Condition/Seal", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Brake Fluid: Level", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Brake Fluid: Condition/Color", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Brake Fluid: Cap Condition/Seal", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Power Steering Fluid: Level (if applicable)", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Power Steering Fluid: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Power Steering Fluid: Cap Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Washer Fluid: Level", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Clutch Fluid: Level/Condition (if applicable)", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Serpentine Belt(s): Condition (Cracks, Glazing)", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Serpentine Belt(s): Tension", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Timing Belt/Chain Cover Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Hoses (Coolant, PS, Vacuum): Condition (Cracks, Swelling, Leaks)", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Hose Clamps: Condition/Tightness", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Battery: Terminals Clean/Tight", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Battery: Hold Down Secure", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Battery: Case Condition (Cracks, Leaks)", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Battery: Date Code/Age", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Battery: Load Test Result", status: "good", notes: "Volts:__ CCA:__", photoUrl: "" },
            { category: "Engine Bay", name: "Alternator Charging Output", status: "good", notes: "Volts:__", photoUrl: "" },
            { category: "Engine Bay", name: "Wiring Harnesses: Condition/Routing", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Connectors: Secure/Corrosion", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Ground Straps: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Air Filter: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Air Filter Housing: Secure/Sealed", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Intake Ducts: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Visible Fluid Leaks (Oil, Coolant, PS, Brake, Fuel)", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Engine Mounts: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Transmission Mounts: Condition", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Exhaust Manifold(s): Cracks/Leaks", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Turbocharger (if equipped): Leaks/Shaft Play/Noise", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Supercharger (if equipped): Belt/Noise/Leaks", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Modifications Noted", status: "good", notes: "", photoUrl: "" },
            { category: "Engine Bay", name: "Component Temp Scan: Engine Block (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Engine Bay", name: "Component Temp Scan: Cylinder Heads (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Engine Bay", name: "Component Temp Scan: Cat Converter (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Engine Bay", name: "Component Temp Scan: Alternator (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Engine Bay", name: "Component Temp Scan: AC Compressor (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },
            { category: "Engine Bay", name: "Component Temp Scan: PS Pump (°F/°C)", status: "good", notes: "Temp: __", photoUrl: "" },

            // --- 6. Test Drive Evaluation ---
            { category: "Test Drive", name: "Pre-Drive: Seatbelt Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Pre-Drive: Mirror Adjustment", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Pre-Drive: Warning Lights Check (Key On)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Cold Start: Cranking Speed/Sound", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Cold Start: Time to Start", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Cold Start: Initial Idle RPM/Smoothness", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Cold Start: Exhaust Smoke", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Cold Start: Unusual Noises", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Idle (Warm): RPM/Smoothness", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Idle (Warm): Unusual Noises", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Idle (Warm): Vibrations", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Parking Lot: Transmission Engagement (D/R)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Parking Lot: Shift Quality (Auto/Manual)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Parking Lot: Clutch Operation (Manual)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Parking Lot: Steering Effort/Smoothness", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Parking Lot: Steering Noise (Lock-to-Lock)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Parking Lot: Low Speed Brake Feel/Noise", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Parking Lot: Parking Brake Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Low Speed (0-30 mph): Acceleration Smoothness", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Low Speed (0-30 mph): Engine Response", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Low Speed (0-30 mph): Transmission Shift Points", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Low Speed (0-30 mph): Braking Feel/Noise", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Low Speed (0-30 mph): Suspension Noise (Bumps)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Low Speed (0-30 mph): Steering Feel/Response", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Acceleration (Merging)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Engine Power/Noise", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Transmission Shifts (Up/Down)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Wind Noise", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Road Noise", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Drivetrain Noise/Vibration", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Straight Line Stability", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Steering Feel (On Center)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Lane Change Stability", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Highway (30-70 mph): Cruise Control Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Braking: Normal Braking Feel/Noise", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Braking: Hard Braking Stability/ABS Function", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Braking: Brake Pedal Feel After Use", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Systems Check: HVAC - A/C Cooling", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Systems Check: HVAC - Heat Output", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Systems Check: HVAC - Fan Speeds/Modes", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Systems Check: Wipers/Washers Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Systems Check: Turn Signals/Lights Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Systems Check: Audio System Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Systems Check: Navigation Operation", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Systems Check: Driver Assist Systems", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Post-Drive: Idle Quality (Warm)", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Post-Drive: Check for Leaks Under Vehicle", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Post-Drive: Brake Temperature Check", status: "good", notes: "LF:__ RF:__ LR:__ RR:__", photoUrl: "" },
            { category: "Test Drive", name: "Post-Drive: Unusual Smells", status: "good", notes: "", photoUrl: "" },
            { category: "Test Drive", name: "Post-Drive: Final Warning Light Check", status: "good", notes: "", photoUrl: "" },

            // --- 7. Final Checks & Diagnostics ---
            { category: "Final Checks & Diagnostics", name: "Final OBD Scan (All Modules)", status: "good", notes: "", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "DTCs Present (Document)", status: "good", notes: "Codes:__", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "Monitor Readiness Status", status: "good", notes: "", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "Freeze Frame Data (if DTCs present)", status: "good", notes: "", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "Live Data Review (Key PIDs if needed)", status: "good", notes: "", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "Final Fluid Level Check (Oil, Coolant)", status: "good", notes: "", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "Final Leak Check (Under Vehicle)", status: "good", notes: "", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "All Tools/Equipment Removed", status: "good", notes: "", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "Vehicle Cleaned (Hands/Tools)", status: "good", notes: "", photoUrl: "" },
            { category: "Final Checks & Diagnostics", name: "Review Photos & Voice Notes", status: "good", notes: "", photoUrl: "" },
        ]
    };

    // Photo data organized by inspection sections
    static photoData = {
        'vehicle-summary': [
            { url: 'photos/IMG_3796.JPG', caption: 'Front View - Vehicle Overview' },
            { url: 'photos/IMG_3797.JPG', caption: 'Side View - Vehicle Profile' },
            { url: 'photos/IMG_3798.JPG', caption: 'Rear View - Vehicle Back' },
            { url: 'photos/IMG_3800.JPG', caption: 'Dashboard - Instrument Cluster' }
        ],
        'diagnostics': [
            { url: 'photos/IMG_3841.JPG', caption: 'OBD-II Port - Diagnostic Connection' },
            { url: 'photos/IMG_3842.JPG', caption: 'Scan Tool - Connected to Vehicle' },
            { url: 'photos/IMG_3843.JPG', caption: 'Diagnostic Results - System Status' },
        ],
        'mechanic-recommendations': [
            { url: 'photos/IMG_3854.JPG', caption: 'Brake System - Service Required' },
            { url: 'photos/IMG_3855.JPG', caption: 'Tire Wear - Replacement Needed' },
            { url: 'photos/IMG_3856.JPG', caption: 'Front Bumper Damage - Cosmetic Repair' },
        ]
    };

    static update(data) {
        if (data.vehicleInfo) {
            this.vehicleInfo = { ...this.vehicleInfo, ...data.vehicleInfo };
        }
        if (data.items) {
            this.checklistData.items = data.items;
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

// Service for loading report data based on VIN
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
        const totalItems = ReportData.checklistData.items.length;
        const itemsPassed = ReportData.checklistData.items.filter(i => i.status === 'good').length;
        const attentionNeeded = ReportData.checklistData.items.filter(i => i.status === 'attention').length;
        const immediateAction = ReportData.checklistData.items.filter(i => i.status === 'immediate').length;
        const score = totalItems ? ((itemsPassed / totalItems) * 10).toFixed(1) : 0;
        const reportSummary = {
            date: vehicleInfo.inspectionDate || '',
            score,
            itemsPassed,
            attentionNeeded,
            immediateAction
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
        const vehicleInfo = ReportData.vehicleInfo;
        const totalItems = ReportData.checklistData.items.length;
        const itemsPassed = ReportData.checklistData.items.filter(i => i.status === 'good').length;
        const attentionNeeded = ReportData.checklistData.items.filter(i => i.status === 'attention').length;
        const immediateAction = ReportData.checklistData.items.filter(i => i.status === 'immediate').length;
        const score = totalItems ? ((itemsPassed / totalItems) * 10).toFixed(1) : 0;
        const reportSummary = {
            date: vehicleInfo.inspectionDate || '',
            score,
            itemsPassed,
            attentionNeeded,
            immediateAction
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
            this.setupEventListeners();
            this.setupAccessibility();
            await this.loadReport();
            console.log('C.A.R.S. Vehicle Report Application initialized successfully');
        } catch (error) {
            ErrorHandler.showError('Failed to initialize application');
            console.error('Initialization error:', error);
        }
    }
    
    static setupEventListeners() {
        // Mobile menu toggle
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mainNavigation = document.getElementById('main-navigation');
        
        if (mobileMenuButton && mainNavigation) {
            // Create mobile menu overlay
            const mobileMenuOverlay = document.createElement('div');
            mobileMenuOverlay.id = 'mobile-menu-overlay';
            mobileMenuOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden transition-opacity duration-300 opacity-0 pointer-events-none';
            document.body.appendChild(mobileMenuOverlay);
            
            // Toggle menu function
            const toggleMenu = (show) => {
                const isOpening = show === undefined ? !mainNavigation.classList.contains('translate-x-0') : show;
                
                if (isOpening) {
                    // Show menu
                    document.body.style.overflow = 'hidden';
                    mobileMenuOverlay.classList.remove('pointer-events-none');
                    mobileMenuOverlay.classList.add('opacity-100');
                    mainNavigation.classList.remove('hidden');
                    mainNavigation.classList.add('translate-x-0');
                    mainNavigation.classList.remove('translate-x-full');
                } else {
                    // Hide menu
                    mobileMenuOverlay.classList.add('opacity-0', 'pointer-events-none');
                    mainNavigation.classList.add('translate-x-full');
                    mainNavigation.classList.remove('translate-x-0');
                    document.body.style.overflow = '';
                    
                    // Wait for transition to complete before hiding
                    setTimeout(() => {
                        if (mainNavigation.classList.contains('translate-x-full')) {
                            mainNavigation.classList.add('hidden');
                        }
                    }, 300);
                }
                
                // Toggle menu icon
                const menuIcon = mobileMenuButton.querySelector('svg');
                if (menuIcon) {
                    menuIcon.innerHTML = isOpening 
                        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />' // X icon
                        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />'; // Hamburger icon
                }
            };
            
            // Toggle menu on button click
            mobileMenuButton.addEventListener('click', () => toggleMenu());
            
            // Close menu when clicking overlay
            mobileMenuOverlay.addEventListener('click', () => toggleMenu(false));
            
            // Close menu when clicking a nav link
            mainNavigation.querySelectorAll('.report-link').forEach(link => {
                link.addEventListener('click', () => toggleMenu(false));
            });
            
            // Close menu when pressing Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !mainNavigation.classList.contains('hidden')) {
                    toggleMenu(false);
                }
            });
        }
        
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
    module.exports = {
        EventHandlers,
        ErrorHandler,
        LoadingIndicator,
        ApiService,
        ChatManager
    };
}
