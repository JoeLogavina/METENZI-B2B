// Quick device detection test utility
export function testDeviceDetection() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  console.log('🔧 Device Test Results:', {
    windowWidth: width,
    windowHeight: height,
    isMobile: width <= 768,
    isTablet: width > 768 && width <= 1024,
    isDesktop: width > 1024,
    userAgent: navigator.userAgent,
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0
  });
  
  return {
    width,
    height,
    isMobile: width <= 768,
    shouldShowMobileUI: width <= 768
  };
}

// Force mobile mode for testing
export function forceMobileMode() {
  console.log('🔧 Forcing mobile mode for testing...');
  // This would temporarily override device detection
  return true;
}