// Simple verification script to test if all build dependencies are available
try {
  console.log('Testing dependency resolution...');
  
  // Test if we can resolve the key packages
  require.resolve('@vitejs/plugin-react');
  console.log('✅ @vitejs/plugin-react found');
  
  require.resolve('vite');
  console.log('✅ vite found');
  
  require.resolve('typescript');
  console.log('✅ typescript found');
  
  require.resolve('esbuild');
  console.log('✅ esbuild found');
  
  console.log('All dependencies verified successfully!');
} catch (error) {
  console.error('❌ Dependency verification failed:', error.message);
  process.exit(1);
}
