import { ImageStorageService } from '../services/image-storage.service';

const imageStorageService = new ImageStorageService();

/**
 * Background job for processing image queue
 * This should be called periodically (e.g., every 5 minutes)
 */
export class ImageProcessorJob {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the background job
   */
  start(intervalMs: number = 5 * 60 * 1000) { // Default: 5 minutes
    if (this.isRunning) {
      console.log('Image processor job is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting image processor job...');

    // Process immediately on start
    this.processQueue();

    // Set up recurring processing
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  /**
   * Stop the background job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Image processor job stopped');
  }

  /**
   * Process the image queue
   */
  private async processQueue() {
    try {
      console.log('Processing image queue...');
      await imageStorageService.processImageQueue(10); // Process up to 10 items
      console.log('Image queue processing completed');
    } catch (error) {
      console.error('Error processing image queue:', error);
    }
  }

  /**
   * Run cleanup job (should be called less frequently, e.g., daily)
   */
  async runCleanup() {
    try {
      console.log('Running image cleanup job...');
      await imageStorageService.cleanupOrphanedFiles();
      console.log('Image cleanup completed');
    } catch (error) {
      console.error('Error during image cleanup:', error);
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null,
    };
  }
}

// Export singleton instance
export const imageProcessorJob = new ImageProcessorJob();