// CensusChat Website JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Demo query animation
    initDemoQuery();
    
    // Smooth scrolling for navigation links
    initSmoothScrolling();
    
    // GitHub stats loading
    loadGitHubStats();
    
    // Intersection observer for animations
    initScrollAnimations();
});

function initDemoQuery() {
    const demoInput = document.querySelector('.demo-input');
    const resultLoading = document.querySelector('.result-loading');
    
    if (!demoInput || !resultLoading) return;
    
    const queries = [
        "What's the population of cities over 100,000 in Texas?",
        "Show me median household income by county in California",
        "Educational attainment rates in major metropolitan areas",
        "Housing costs compared to income in Seattle metro area",
        "Population growth trends in rural vs urban counties"
    ];
    
    let currentQueryIndex = 0;
    
    function cycleQuery() {
        demoInput.value = queries[currentQueryIndex];
        currentQueryIndex = (currentQueryIndex + 1) % queries.length;
    }
    
    // Initial query
    cycleQuery();
    
    // Cycle through queries every 4 seconds
    setInterval(cycleQuery, 4000);
    
    // Simulate query processing
    demoInput.addEventListener('focus', function() {
        resultLoading.innerHTML = `
            <div class="spinner"></div>
            <span>Processing natural language query...</span>
        `;
        
        setTimeout(() => {
            resultLoading.innerHTML = `
                <div style="color: var(--success-color); font-weight: 500;">
                    ✅ Found 47 cities in Texas with population > 100,000
                </div>
                <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    Query executed in 1.2 seconds • 2.3M records analyzed
                </div>
            `;
        }, 2000);
    });
}

function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function loadGitHubStats() {
    // This would normally fetch from GitHub API
    // For now, we'll use placeholder functionality
    
    const githubStatsContainer = document.querySelector('.github-stats');
    if (!githubStatsContainer) return;
    
    // Add click tracking for GitHub links
    const githubLinks = document.querySelectorAll('a[href*="github.com"]');
    githubLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Track GitHub clicks
            if (typeof gtag !== 'undefined') {
                gtag('event', 'click', {
                    event_category: 'GitHub',
                    event_label: this.href
                });
            }
        });
    });
}

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for scroll animations
    const animatedElements = document.querySelectorAll('.feature, .tech-item, .contrib-item, .roadmap-item');
    animatedElements.forEach(el => {
        observer.observe(el);
    });
}

// Add CSS for scroll animations
const scrollAnimationCSS = `
    .feature, .tech-item, .contrib-item, .roadmap-item {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease, transform 0.6s ease;
    }
    
    .feature.animate-in, .tech-item.animate-in, .contrib-item.animate-in, .roadmap-item.animate-in {
        opacity: 1;
        transform: translateY(0);
    }
    
    /* Stagger animation delays */
    .feature:nth-child(1) { transition-delay: 0.1s; }
    .feature:nth-child(2) { transition-delay: 0.2s; }
    .feature:nth-child(3) { transition-delay: 0.3s; }
    .feature:nth-child(4) { transition-delay: 0.4s; }
    .feature:nth-child(5) { transition-delay: 0.5s; }
    .feature:nth-child(6) { transition-delay: 0.6s; }
`;

// Inject the CSS
const style = document.createElement('style');
style.textContent = scrollAnimationCSS;
document.head.appendChild(style);

// Form handling for potential contact forms
function handleFormSubmission(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    
    // Placeholder for form submission
    setTimeout(() => {
        // Reset form
        form.reset();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // Show success message
        showNotification('Message sent successfully!', 'success');
    }, 1000);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" aria-label="Close">&times;</button>
    `;
    
    // Add notification styles if not already present
    if (!document.querySelector('#notification-styles')) {
        const notificationCSS = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-lg);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 1rem;
                max-width: 400px;
                animation: slideIn 0.3s ease;
            }
            
            .notification-success {
                background: var(--success-color);
                color: white;
            }
            
            .notification-error {
                background: var(--error-color);
                color: white;
            }
            
            .notification-info {
                background: var(--primary-color);
                color: white;
            }
            
            .notification button {
                background: none;
                border: none;
                color: inherit;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = notificationCSS;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Error handling
window.addEventListener('error', function(event) {
    console.error('JavaScript error:', event.error);
    // Optionally show user-friendly error message
});

// Performance monitoring
window.addEventListener('load', function() {
    // Log page load performance
    const navigationTiming = performance.getEntriesByType('navigation')[0];
    if (navigationTiming) {
        console.log('Page load time:', navigationTiming.loadEventEnd - navigationTiming.fetchStart, 'ms');
    }
});